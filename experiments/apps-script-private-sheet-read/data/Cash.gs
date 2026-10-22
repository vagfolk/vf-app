// Privat lagring för försäljningskassan. CashCore.gs genereras från de testade
// källmodulerna. Testkassan är publicerad med låtsasdata; ett kontantflöde har
// provats mot EKO-testkopian. Offline- och Swishflödena är inte liveverifierade.
const CASH_FOLDER_PROPERTY = 'VF_TEST_CASH_FOLDER_ID';
const CASH_VERSION_PROPERTY = 'VF_TEST_CASH_VERSION';
const CASH_SEQUENCE_PREFIX = 'VF_TEST_CASH_SEQUENCE_';
const CASH_SWISH_ENABLED_PROPERTY = 'VF_TEST_CASH_SWISH_ENABLED';
const CASH_SWISH_NUMBER_PROPERTY = 'VF_TEST_CASH_SWISH_NUMBER';
function cashSwishReady_(properties) {
  return properties.getProperty(CASH_SWISH_ENABLED_PROPERTY) === 'true' &&
    /^\d{10,15}$/.test(properties.getProperty(CASH_SWISH_NUMBER_PROPERTY) || '');
}

function cashBoard_(roles) {
  return roles.some(role => ['Styrelse', 'Sekreterare', 'Kassör', 'Admin'].includes(role));
}
function cashTreasurer_(roles) {
  return roles.some(role => role === 'Kassör' || role === 'Admin');
}
function cashJson_(content) {
  let input;
  try { input = JSON.parse(content); } catch (_error) { throw new Error('invalid_content'); }
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      Object.keys(input).length > 20) throw new Error('invalid_content');
  return input;
}
function cashFolder_(properties) {
  let folderId = properties.getProperty(CASH_FOLDER_PROPERTY);
  if (folderId) {
    if (!/^[A-Za-z0-9_-]{20,128}$/.test(folderId)) throw new Error('invalid_cash_folder');
    return folderId;
  }
  const root = properties.getProperty(APP_ROOT_FOLDER_PROPERTY);
  if (!/^[A-Za-z0-9_-]{20,128}$/.test(root || '')) throw new Error('app_root_missing');
  // Anroparen håller skriptlåset vid skapande.
  const created = driveRequest_('https://www.googleapis.com/drive/v3/files?fields=id',
    'post', { name: 'Försäljningskassor', mimeType: 'application/vnd.google-apps.folder',
      parents: [root] }, ScriptApp.getOAuthToken());
  folderId = created.id;
  if (!/^[A-Za-z0-9_-]{20,128}$/.test(folderId || '')) throw new Error('cash_folder_failed');
  properties.setProperty(CASH_FOLDER_PROPERTY, folderId);
  return folderId;
}
function cashFiles_(folderId) {
  const files = [];
  let page = '';
  for (let index = 0; index < 20; index++) {
    const query = "'" + folderId + "' in parents and trashed = false and mimeType = 'application/json'";
    const url = 'https://www.googleapis.com/drive/v3/files?q=' + encodeURIComponent(query) +
      '&fields=' + encodeURIComponent('nextPageToken,files(id,name,mimeType)') +
      '&pageSize=100' + (page ? '&pageToken=' + encodeURIComponent(page) : '');
    const result = driveRequest_(url, 'get', null, ScriptApp.getOAuthToken());
    if (!Array.isArray(result.files)) throw new Error('cash_list_failed');
    files.push(...result.files);
    if (files.length > 2000) throw new Error('cash_limit_reached');
    page = result.nextPageToken || '';
    if (!page) return files;
  }
  throw new Error('cash_limit_reached');
}
function cashFile_(fileId, associationId) {
  const response = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' +
    encodeURIComponent(fileId) + '?alt=media', {
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
      muteHttpExceptions: true
    });
  if (response.getResponseCode() !== 200) throw new Error('cash_read_failed');
  const content = response.getContentText('UTF-8');
  if (content.length < 10 || content.length > 1000000) throw new Error('cash_file_invalid');
  const cash = JSON.parse(content);
  if (cash.associationId !== associationId ||
      !/^K-\d{4}-\d{4,}$/.test(cash.id || '') ||
      !Array.isArray(cash.events) || !Array.isArray(cash.purchases)) {
    throw new Error('cash_file_invalid');
  }
  return cash;
}
function cashSave_(folderId, cash, existingId) {
  const name = cash.accountingDate + '_' + cash.id + '.json';
  const id = saveContactFile_(folderId, name, 'application/json',
    Utilities.newBlob(JSON.stringify(cash), 'application/json').getBytes(), existingId);
  return id;
}
function cashFind_(folderId, cashId, associationId) {
  if (!/^K-\d{4}-\d{4,}$/.test(cashId || '')) throw new Error('invalid_cash_id');
  const query = "'" + folderId + "' in parents and trashed = false and " +
    "mimeType = 'application/json' and name contains '" + cashId + ".json'";
  const result = driveRequest_('https://www.googleapis.com/drive/v3/files?q=' +
    encodeURIComponent(query) + '&fields=' +
    encodeURIComponent('nextPageToken,files(id,name,mimeType)') + '&pageSize=100',
    'get', null, ScriptApp.getOAuthToken());
  if (!Array.isArray(result.files) || result.nextPageToken) throw new Error('cash_list_failed');
  const matches = result.files.filter(file => file.name.endsWith('_' + cashId + '.json'));
  if (matches.length !== 1) throw new Error(matches.length ? 'duplicate_cash' : 'cash_not_found');
  return { fileId: matches[0].id, cash: cashFile_(matches[0].id, associationId) };
}
function cashSummary_(cash) {
  const totals = VFCashCore.cashTotals(cash);
  return { id: cash.id, openedAt: cash.openedAt,
    accountingDate: cash.accountingDate, ownerMemberId: cash.ownerMemberId,
    ownerName: cash.ownerName, status: cash.status,
    closedAt: cash.close?.at || null, syncedAt: cash.syncedAt || null,
    deviceLost: cash.abort?.deviceLost === true,
    recoveryCompleteAt: cash.abort?.recoveryCompleteAt || null,
    purchases: cash.purchases.length,
    expectedCashCents: totals.expectedCashCents,
    swishReceiptsCents: totals.swishReceiptsCents };
}
function cashHandle_(action, content, row, roles, members, associationId, properties, spreadsheetId) {
  if (!cashBoard_(roles)) return reply_(false, 'insufficient_role');
  if (!['cash_list', 'cash_get', 'cash_open', 'cash_event', 'cash_abort',
      'cash_review', 'cash_manual_book', 'cash_post',
      'cash_verify_swish', 'cash_recovery_done', 'cash_mark_lost', 'cash_qr'].includes(action)) {
    return reply_(false, 'invalid_action');
  }
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return reply_(false, 'busy');
  try {
    const folderId = cashFolder_(properties);
    if (action === 'cash_list') {
      const cashes = cashFiles_(folderId).map(file => cashFile_(file.id, associationId));
      const suggestions = new Map();
      for (const cash of cashes.sort((a, b) => a.openedAt.localeCompare(b.openedAt))) {
        for (const product of cash.products) {
          suggestions.set(product.name.toLocaleLowerCase('sv'),
            { name: product.name, priceCents: product.priceCents });
        }
      }
      return reply_(true, null,
        { cashes: cashes.map(cashSummary_).sort((a, b) => b.id.localeCompare(a.id)),
          products: [...suggestions.values()].slice(-100),
          viewerMemberId: row[16],
          canReview: cashTreasurer_(roles),
          swishEnabled: cashSwishReady_(properties) });
    }
    const input = cashJson_(content);
    if (action === 'cash_open') {
      if (typeof input.requestId !== 'string' || !/^[A-Za-z0-9_-]{8,80}$/.test(input.requestId) ||
          typeof input.deviceId !== 'string' || !/^[A-Za-z0-9_-]{8,80}$/.test(input.deviceId)) {
        return reply_(false, 'invalid_content');
      }
      const cashes = cashFiles_(folderId).map(file => cashFile_(file.id, associationId));
      const replay = cashes.find(cash => cash.openingRequestId === input.requestId);
      if (replay) return replay.ownerMemberId === row[16] && replay.deviceId === input.deviceId
        ? reply_(true, null, { cash: replay, replay: true })
        : reply_(false, 'cash_request_reused');
      if (cashes.some(cash => cash.status === 'open' &&
          (cash.ownerMemberId === row[16] || cash.deviceId === input.deviceId))) {
        return reply_(false, 'cash_already_open');
      }
      const now = new Date();
      const date = Utilities.formatDate(now, 'Europe/Stockholm', 'yyyy-MM-dd');
      const year = date.slice(0, 4);
      const sequenceProperty = CASH_SEQUENCE_PREFIX + year;
      const sequence = Number(properties.getProperty(sequenceProperty) || 0) + 1;
      if (!Number.isSafeInteger(sequence) || sequence > 999999) return reply_(false, 'cash_limit_reached');
      // Numret reserveras först. Ett avbrott får lämna ett glapp, aldrig en dubblett.
      properties.setProperty(sequenceProperty, String(sequence));
      const cash = VFCashCore.openCashRegister({
        id: 'K-' + year + '-' + String(sequence).padStart(4, '0'),
        associationId: associationId, ownerMemberId: row[16],
        deviceId: input.deviceId, openedAt: now.toISOString(),
        accountingDate: date, openingFloatCents: input.openingFloatCents,
        products: input.products || []
      });
      cash.openingRequestId = input.requestId;
      cash.ownerName = row[1];
      cashSave_(folderId, cash, null);
      properties.setProperty(CASH_VERSION_PROPERTY, new Date().toISOString());
      return reply_(true, null, { cash: cash });
    }
    const found = cashFind_(folderId, input.cashId, associationId);
    let cash = found.cash;
    if (action === 'cash_get') return reply_(true, null, { cash: cash });
    if (action === 'cash_qr') {
      if (cash.ownerMemberId !== row[16] || cash.deviceId !== input.deviceId) {
        return reply_(false, 'cash_wrong_owner_or_device');
      }
      return reply_(true, null, cashQrCreate_(cash, input, properties));
    }
    if (action === 'cash_event') {
      if (cash.ownerMemberId !== row[16] || cash.deviceId !== input.deviceId) {
        return reply_(false, 'cash_wrong_owner_or_device');
      }
      const event = input.event;
      if (!event || typeof event !== 'object' || Array.isArray(event)) {
        return reply_(false, 'invalid_content');
      }
      const recovering = cash.status === 'aborted_pending_review' && !cash.review;
      if (recovering) cash.status = 'open';
      if (event.kind === 'add_product') {
        cash = VFCashCore.addCashProduct(cash, event.product, event.operationId, event.at);
      } else if (event.kind === 'update_product') {
        cash = VFCashCore.updateCashProduct(cash, event.productId, event.priceCents,
          event.operationId, event.at);
      } else if (event.kind === 'purchase') {
        cash = VFCashCore.recordCashPurchase(cash, {
          ...event, swishEnabled: cashSwishReady_(properties)
        });
      } else if (event.kind === 'void') {
        cash = VFCashCore.voidCashPurchase(cash, event);
      } else if (event.kind === 'close') {
        if (cash.close?.operationId === event.operationId) {
          VFCashCore.closeCashRegister(cash, event);
          if (recovering) cash.status = 'aborted_pending_review';
          return reply_(true, null, { cash: cash, replay: true });
        }
        if (!recovering && (!Number.isSafeInteger(event.expectedEventCount) ||
            event.expectedEventCount !== cash.events.length)) {
          return reply_(false, 'cash_pending_events');
        }
        cash = VFCashCore.closeCashRegister(cash, event);
        const closer = members.slice(1).find(member => member[16] === cash.close.closerMemberId);
        if (!closer || closer[20] !== 'Aktiv' ||
            !cashBoard_([closer[18] || 'Medlem', closer[19]].filter(Boolean))) {
          return reply_(false, 'closer_not_board_member');
        }
        cash = VFCashCore.verifyCashCloser(cash, { memberId: closer[16],
          name: closer[1], role: closer[18] || closer[19], board: true },
        new Date().toISOString());
        if (!recovering) cash = VFCashCore.markCashSynced(cash, new Date().toISOString());
      } else return reply_(false, 'invalid_action');
      if (recovering) {
        cash.status = 'aborted_pending_review';
        cash.abort.recoveredPurchases = cash.purchases.length;
        cash.abort.recoveredAt = new Date().toISOString();
      }
    } else if (action === 'cash_abort') {
      cash = VFCashCore.abortCashRegister(cash, { ...input, board: true,
        actorMemberId: row[16],
        at: cash.abort?.operationId === input.operationId
          ? cash.abort.at : new Date().toISOString() });
    } else if (action === 'cash_recovery_done') {
      if (cash.ownerMemberId !== row[16] || cash.deviceId !== input.deviceId) {
        return reply_(false, 'cash_wrong_owner_or_device');
      }
      if (cash.status !== 'aborted_pending_review' || cash.review) {
        return reply_(false, 'cash_recovery_closed');
      }
      if (!cash.abort.recoveryCompleteAt) {
        cash.abort.recoveryCompleteAt = new Date().toISOString();
        cash.abort.recoveryMemberId = row[16];
      }
    } else if (action === 'cash_mark_lost') {
      if (cash.status !== 'aborted_pending_review' || cash.review) {
        return reply_(false, 'cash_recovery_closed');
      }
      if (typeof input.reason !== 'string' || !input.reason.trim() ||
          input.reason.length > 300) return reply_(false, 'invalid_content');
      if (!cash.abort.deviceLost) {
        cash.abort.deviceLost = true;
        cash.abort.lostReason = input.reason.trim();
        cash.abort.lostAt = new Date().toISOString();
        cash.abort.lostByMemberId = row[16];
      }
    } else if (action === 'cash_review') {
      if (!cashTreasurer_(roles)) return reply_(false, 'insufficient_role');
      if (cash.status === 'aborted_pending_review' &&
          !cash.abort.deviceLost && !cash.abort.recoveryCompleteAt) {
        return reply_(false, 'cash_recovery_pending');
      }
      cash = VFCashCore.reviewCashRegister(cash, { ...input,
        cashierRole: roles.includes('Admin') ? 'Admin' : 'Kassör',
        reviewerMemberId: row[16],
        at: cash.review?.operationId === input.operationId
          ? cash.review.at : new Date().toISOString() });
      if (cash.status === 'approved_for_posting') {
        // Godkännande startar kontantöverföringen direkt. Om svaret förloras
        // återfinns redan skrivna rader via deras oföränderliga referenser.
        const posted = cashEkoWriteCash_(spreadsheetId, cash, associationId);
        if (!cash.cashPosting) cash.cashPosting = {
          at: new Date().toISOString(), byMemberId: row[16],
          cashRows: posted.cashRows, swishToBook: posted.swishToBook
        };
        if (posted.swishToBook === 0) {
          cash = VFCashCore.markCashPosted(cash, new Date().toISOString());
        }
      }
    } else if (action === 'cash_manual_book') {
      if (!cashTreasurer_(roles)) return reply_(false, 'insufficient_role');
      cash = VFCashCore.markCashManuallyBooked(cash, { ...input,
        cashierRole: roles.includes('Admin') ? 'Admin' : 'Kassör',
        reviewerMemberId: row[16],
        at: cash.posting?.operationId === input.operationId
          ? cash.posting.at : new Date().toISOString() });
    } else if (action === 'cash_post') {
      if (!cashTreasurer_(roles)) return reply_(false, 'insufficient_role');
      if (cash.status === 'posted' && cash.cashPosting) {
        return reply_(true, null, { cash: cash, replay: true });
      }
      const posted = cashEkoWriteCash_(spreadsheetId, cash, associationId);
      if (!cash.cashPosting) {
        cash.cashPosting = { at: new Date().toISOString(), byMemberId: row[16],
          cashRows: posted.cashRows, swishToBook: posted.swishToBook };
      }
      if (posted.swishToBook === 0) cash = VFCashCore.markCashPosted(cash, new Date().toISOString());
    } else if (action === 'cash_verify_swish') {
      if (!cashTreasurer_(roles)) return reply_(false, 'insufficient_role');
      if (cash.status === 'posted' && cash.cashPosting) {
        return reply_(true, null, { cash: cash, replay: true });
      }
      cashEkoVerifyManualSwish_(spreadsheetId, cash, associationId);
      cash = VFCashCore.markCashPosted(cash, new Date().toISOString());
    }
    if (JSON.stringify(cash).length > 900000) return reply_(false, 'cash_limit_reached');
    cashSave_(folderId, cash, found.fileId);
    properties.setProperty(CASH_VERSION_PROPERTY, new Date().toISOString());
    return reply_(true, null, { cash: cash });
  } catch (error) {
    const reason = String(error && error.message || 'cash_unavailable');
    const safe = /^(invalid_content|invalid_action|invalid_cash_id|cash_not_found|duplicate_cash|cash_limit_reached|cash_wrong_owner_or_device|cash_already_open|cash_request_reused|cash_pending_events|closer_not_board_member|cash_not_approved|cash_swish_not_booked|cash_swish_eko_conflict|cash_eko_conflict|cash_eko_full|cash_eko_write_unverified|cash_eko_category_missing|cash_eko_structure_changed|cash_eko_period_mismatch|cash_recovery_pending|cash_recovery_closed|cash_swish_disabled|cash_qr_unavailable)$/.test(reason);
    return reply_(false, safe ? reason : 'cash_unavailable');
  } finally { lock.releaseLock(); }
}
