// ENDAST TESTDATA. Webbappen kör som testfilens ägare och läser en fil vars ID
// ligger i Script Properties. Inga riktiga medlems- eller ekonomidata får anges.
const ASSOCIATION_PROPERTY = 'VF_TEST_ASSOCIATION_ID';
const KEY_PROPERTY = 'VF_TEST_BRIDGE_KEY';
const SHEET_PROPERTY = 'VF_TEST_SPREADSHEET_ID';
const EKO_FOLDER_PROPERTY = 'VF_TEST_EKO_FOLDER_ID';
const MEMBER_CALENDAR_PROPERTY = 'VF_MEMBER_CALENDAR_ID';
const BOARD_CALENDAR_PROPERTY = 'VF_BOARD_CALENDAR_ID';
const MESSAGES_SHEET_PROPERTY = 'VF_TEST_MESSAGES_SHEET_ID';
const MESSAGES_FOLDER_PROPERTY = 'VF_TEST_MESSAGES_FOLDER_ID';
const CONTACT_FOLDER_PROPERTY = 'VF_TEST_CONTACT_FOLDER_ID';
const APP_ROOT_FOLDER_PROPERTY = 'VF_TEST_APP_ROOT_FOLDER_ID';
const CONTACT_VERSION_PROPERTY = 'VF_TEST_CONTACTS_VERSION';
const DOCUMENT_ROOT_PROPERTY = 'VF_TEST_DOCUMENT_ROOT_ID';
const DOCUMENT_MEMBER_PROPERTY = 'VF_TEST_DOCUMENT_MEMBER_ID';
const DOCUMENT_BOARD_PROPERTY = 'VF_TEST_DOCUMENT_BOARD_ID';
const DOCUMENT_VERSION_PROPERTY = 'VF_TEST_DOCUMENT_VERSION';
const MAX_DOCUMENT_BYTES = 5000000;
const MAX_AGE_MS = 120000;

function doGet() {
  return ContentService.createTextOutput('VF privat läsprov – endast låtsasdata');
}

// Körs manuellt av skriptägaren om Googles befintliga drive.file-medgivande
// behöver förnyas. Läser endast rubriken och loggar aldrig cellinnehåll.
function verifyEkoAuthorization() {
  ScriptApp.requireScopes(ScriptApp.AuthMode.FULL,
    ['https://www.googleapis.com/auth/drive.file']);
  const sheetId = PropertiesService.getScriptProperties().getProperty(SHEET_PROPERTY);
  if (!/^[A-Za-z0-9_-]{20,128}$/.test(sheetId || '')) throw new Error('EKO saknas');
  const rows = readRange_(sheetId, "'Medlemmar'!B11:B11");
  if (!rows || !rows[0] || rows[0][0] !== 'Namn') throw new Error('EKO-rubrik saknas');
  console.log('VF EKO-läsning fungerar');
}

// Körs EN gång manuellt från redigeraren för att prova drive.file utan
// åtkomst till ett befintligt ark. Funktionen skapar enbart låtsasdata.
function createDriveFileTest() {
  const properties = PropertiesService.getScriptProperties();
  const subject = properties.getProperty('VF_TEST_OWNER_SUB');
  if (!/^[0-9]{6,30}$/.test(subject || '')) throw new Error('Testidentitet saknas');
  if (properties.getProperty(SHEET_PROPERTY + '_CREATED')) {
    throw new Error('Testfil har redan skapats');
  }
  const ekoFolderId = properties.getProperty(EKO_FOLDER_PROPERTY);
  if (!/^[A-Za-z0-9_-]{20,128}$/.test(ekoFolderId || '')) {
    throw new Error('EKO-mappen saknas');
  }
  const token = ScriptApp.getOAuthToken();
  const created = sheetsRequest_('https://sheets.googleapis.com/v4/spreadsheets', 'post', {
    properties: { title: 'VF drive.file-prov – ENDAST TESTDATA' },
    sheets: [{ properties: { title: 'Medlemmar' } },
      { properties: { title: 'Kassabok' } }]
  }, token);
  const id = created && created.spreadsheetId;
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{20,128}$/.test(id)) {
    throw new Error('Google gav inget giltigt fil-ID');
  }
  const meta = driveRequest_('https://www.googleapis.com/drive/v3/files/' +
    encodeURIComponent(id) + '?fields=parents', 'get', null, token);
  const oldParents = (meta.parents || []).join(',');
  driveRequest_('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(id) +
    '?addParents=' + encodeURIComponent(ekoFolderId) +
    (oldParents ? '&removeParents=' + encodeURIComponent(oldParents) : '') +
    '&fields=id,parents', 'patch', null, token);
  const header = ['Nr', 'Namn', 'Telefon', 'E-post', 'Medlemstyp', 'Familje-ID',
    'Avgiftsskyldig?', 'Avgift', 'Egen avgift', 'Inbetalt belopp', 'Betalstatus',
    'Betalsätt', 'Betald datum', 'Radstatus', 'Kommentar', 'Betalningsreferens',
    'Medlems-ID', 'Google-konto-ID', 'Approll', 'Extra approll', 'Appstatus'];
  const member = ['', 'TESTPERSON', '', '', 'Medlem', '', true, 300, '', 300,
    'Betald', '', '', '', '', '', 'TEST-MEDLEM-0001', subject, 'Styrelse', '',
    'Aktiv'];
  sheetsRequest_('https://sheets.googleapis.com/v4/spreadsheets/' +
    encodeURIComponent(id) + '/values:batchUpdate', 'post', {
    valueInputOption: 'RAW', data: [
      { range: "'Medlemmar'!A11:U12", values: [header, member] },
      { range: "'Kassabok'!A5:F9", values: [
        ['Period', '2026-01-01 – 2026-12-31'],
        ['Ingående bank', 0, 'Ingående kontant', 0],
        ['Inkomst bank/Swish', 798.1, 'Inkomst kontant', 200],
        ['Utgift bank/Swish', 0, 'Utgift kontant', 0],
        ['Utgående bank', 798.1, 'Utgående kontant', 200, 'Resultat', 998.1]
      ] }
    ]
  }, token);
  properties.setProperty(SHEET_PROPERTY + '_CREATED', id);
  properties.setProperty(SHEET_PROPERTY, id);
  console.log('Drive.file-testfil skapad och vald: ' + id);
}

function sheetsRequest_(url, method, payload, token) {
  const options = { method: method,
    headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true };
  if (payload !== null && payload !== undefined) {
    options.contentType = 'application/json';
    options.payload = JSON.stringify(payload);
  }
  const response = UrlFetchApp.fetch(url, options);
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
    const detail = JSON.parse(response.getContentText()).error;
    throw new Error('Sheets API HTTP ' + response.getResponseCode() + ': ' +
      String(detail.message || detail.status)
        .replace(/[A-Za-z0-9_-]{80,}/g, '[dolt]').slice(0, 500));
  }
  return JSON.parse(response.getContentText());
}

function doPost(event) {
  try {
    const raw = event && event.postData && event.postData.contents;
    if (typeof raw !== 'string' || raw.length > 7200000) return reply_(false, 'invalid_request');
    const envelope = JSON.parse(raw);
    if (!envelope || typeof envelope.body !== 'string' || typeof envelope.mac !== 'string' ||
        envelope.body.length > 7100000 || !/^[A-Za-z0-9_-]{43}$/.test(envelope.mac)) {
      return reply_(false, 'invalid_request');
    }
    const properties = PropertiesService.getScriptProperties();
    const keyText = properties.getProperty(KEY_PROPERTY);
    const associationId = properties.getProperty(ASSOCIATION_PROPERTY);
    const spreadsheetId = properties.getProperty(SHEET_PROPERTY);
    if (!keyText || !associationId || !spreadsheetId) return reply_(false, 'setup_missing');
    const keyBytes = Utilities.base64DecodeWebSafe(keyText);
    if (keyBytes.length !== 32 || !/^[A-Za-z0-9_-]{8,64}$/.test(associationId) ||
        !/^[A-Za-z0-9_-]{20,128}$/.test(spreadsheetId)) {
      return reply_(false, 'setup_invalid');
    }
    const expected = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(
      Utilities.newBlob(envelope.body, 'text/plain').getBytes(), keyBytes)).replace(/=+$/, '');
    if (!sameBytes_(expected, envelope.mac)) return reply_(false, 'invalid_signature');
    const body = JSON.parse(envelope.body);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return reply_(false, 'wrong_association_or_action');
    }
    const hasContent = Object.prototype.hasOwnProperty.call(body, 'content');
    const contentAction = ['publish_information', 'delete_information', 'post_chat', 'create_task',
      'complete_task', 'recall_task', 'archive_task', 'save_contact', 'delete_contact',
      'document_open', 'document_upload', 'document_delete',
      'cash_get', 'cash_open', 'cash_event', 'cash_abort', 'cash_review',
      'cash_manual_book', 'cash_post', 'cash_verify_swish',
      'cash_recovery_done', 'cash_mark_lost', 'cash_qr'].includes(body.action);
    const expectedKeys = hasContent
      ? 'action,associationId,content,nonce,subject,ts,v'
      : 'action,associationId,nonce,subject,ts,v';
    if (Object.keys(body).sort().join(',') !== expectedKeys) return reply_(false, 'wrong_association_or_action');
    if (body.v !== 1 || body.associationId !== associationId) return reply_(false, 'wrong_association_or_action');
    if (!['profile', 'own_fee', 'board_summary', 'treasurer_eko', 'calendar', 'calendar_version', 'app_versions', 'information', 'chat',
          'publish_information', 'delete_information', 'post_chat', 'tasks', 'contacts',
          'create_task', 'complete_task', 'recall_task', 'archive_task', 'save_contact',
          'delete_contact', 'documents', 'document_open', 'document_upload', 'document_delete',
          'leave_app', 'cash_list', 'cash_get', 'cash_open',
          'cash_event', 'cash_abort', 'cash_review', 'cash_manual_book',
          'cash_post', 'cash_verify_swish', 'cash_recovery_done', 'cash_mark_lost',
          'cash_qr'
        ].includes(body.action)) return reply_(false, 'wrong_association_or_action');
    if (typeof body.subject !== 'string' || !body.subject || body.subject.length > 255) return reply_(false, 'wrong_association_or_action');
    if (typeof body.nonce !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.nonce)) return reply_(false, 'wrong_association_or_action');
    if (contentAction !== hasContent ||
        (hasContent && (typeof body.content !== 'string' ||
          body.content.length > (body.action === 'document_upload' ? 7100000 :
            body.action === 'save_contact' ? 170000 :
            body.action.startsWith('cash_') ? 25000 : 600)))) {
      return reply_(false, 'wrong_association_or_action');
    }
    if (!Number.isSafeInteger(body.ts) || Math.abs(Date.now() - body.ts) > MAX_AGE_MS) {
      return reply_(false, 'stale_request');
    }
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(5000)) return reply_(false, 'busy');
    try {
      const cache = CacheService.getScriptCache();
      const cacheKey = 'nonce:' + body.nonce;
      if (cache.get(cacheKey)) return reply_(false, 'replayed_request');
      cache.put(cacheKey, '1', 180);
    } finally {
      lock.releaseLock();
    }

    // En dokumentöppning använder den kortlivade roll som redan kontrollerades
    // när dokumentlistan lästes. Den gör inget nytt EKO-anrop.
    if (body.action === 'document_open') {
      return openDocument_(body.content, body.subject, associationId, properties);
    }

    const members = readRange_(spreadsheetId, "'Medlemmar'!A11:U1011");
    if (!members || !members[0] ||
        members[0][1] !== 'Namn' || members[0][7] !== 'Avgift' ||
        members[0][9] !== 'Inbetalt belopp' || members[0][16] !== 'Medlems-ID' ||
        members[0][17] !== 'Google-konto-ID' || members[0][18] !== 'Approll' ||
        members[0][19] !== 'Extra approll' || members[0][20] !== 'Appstatus') {
      return reply_(false, 'test_sheet_invalid');
    }
    const matching = members.slice(1).filter(row => row[17] === body.subject);
    if (matching.length === 0) return reply_(false, 'unknown_user');
    if (matching.length !== 1) return reply_(false, 'duplicate_identity');
    const row = matching[0];
    if (row[20] !== 'Aktiv') return reply_(false, 'inactive_user');
    const roles = [row[18] || 'Medlem', row[19]].filter(Boolean);
    if (roles.some(role => !['Medlem', 'Styrelse', 'Sekreterare', 'Kassör', 'Admin'].includes(role)) ||
        typeof row[16] !== 'string' || !row[16] || row[16].length > 80 ||
        typeof row[1] !== 'string' || !row[1]) {
      return reply_(false, 'test_sheet_invalid');
    }
    if (body.action === 'leave_app') {
      CacheService.getScriptCache().remove('online:' + associationId + ':' + row[16]);
      return reply_(true, null, { saved: true });
    }
    if (body.action.startsWith('cash_')) {
      return cashHandle_(body.action, body.content, row, roles, members,
        associationId, properties, spreadsheetId);
    }
    if (body.action === 'app_versions') {
      const boardAllowed = roles.some(role =>
        ['Styrelse', 'Sekreterare', 'Kassör', 'Admin'].includes(role));
      const memberCalendarId = properties.getProperty(MEMBER_CALENDAR_PROPERTY);
      const boardCalendarId = properties.getProperty(BOARD_CALENDAR_PROPERTY);
      const messagesId = properties.getProperty(MESSAGES_SHEET_PROPERTY);
      if (!validCalendarId_(memberCalendarId) ||
          (boardAllowed && !validCalendarId_(boardCalendarId)) ||
          !/^[A-Za-z0-9_-]{20,128}$/.test(messagesId || '')) {
        return reply_(false, 'setup_missing');
      }
      const calendar = { member: readCalendarUpdated_(memberCalendarId) };
      if (boardAllowed) calendar.board = readCalendarUpdated_(boardCalendarId);
      return reply_(true, null, {
        eko: readDriveModified_(spreadsheetId),
        store: readDriveModified_(messagesId),
        contacts: properties.getProperty(CONTACT_VERSION_PROPERTY) || '1970-01-01T00:00:00.000Z',
        documents: properties.getProperty(DOCUMENT_VERSION_PROPERTY) || '1970-01-01T00:00:00.000Z',
        online: touchPresence_(members, associationId, row[16]),
        calendar: calendar
      });
    }
    if (['information', 'chat', 'publish_information', 'delete_information', 'post_chat'].includes(body.action)) {
      const messagesId = properties.getProperty(MESSAGES_SHEET_PROPERTY);
      if (!/^[A-Za-z0-9_-]{20,128}$/.test(messagesId || '')) {
        return reply_(false, 'messages_setup_missing');
      }
      const boardAllowed = roles.some(role =>
        ['Styrelse', 'Sekreterare', 'Kassör', 'Admin'].includes(role));
      if (body.action === 'information') return reply_(true, null,
        readInformation_(messagesId, boardAllowed));
      if (body.action === 'chat') return reply_(true, null, readChat_(messagesId));
      if (['publish_information', 'delete_information'].includes(body.action) && !boardAllowed) {
        return reply_(false, 'insufficient_role');
      }
      if (body.action === 'delete_information') {
        return deleteInformation_(messagesId, body.content, row[16]);
      }
      const maxLength = body.action === 'post_chat' ? 120 : 600;
      const content = body.content.trim();
      if (!content || content.length > maxLength || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(content)) {
        return reply_(false, 'invalid_content');
      }
      appendMessage_(messagesId, body.action === 'post_chat' ? 'Chat' : 'Information',
        content, row[16], row[1]);
      return reply_(true, null, { saved: true });
    }
    if (body.action === 'contacts') return reply_(true, null,
      { contacts: visibleContacts_(members, properties) });
    if (body.action === 'documents') {
      const boardAllowed = roles.some(role =>
        ['Styrelse', 'Sekreterare', 'Kassör', 'Admin'].includes(role));
      CacheService.getScriptCache().put('doc-role:' + associationId + ':' + body.subject,
        JSON.stringify({ board: boardAllowed,
          eko: readDriveModified_(spreadsheetId) }), 900);
      return reply_(true, null, { documents: visibleDocuments_(properties, boardAllowed) });
    }
    if (body.action === 'document_upload') {
      if (!roles.some(role =>
          ['Styrelse', 'Sekreterare', 'Kassör', 'Admin'].includes(role))) {
        return reply_(false, 'insufficient_role');
      }
      return uploadDocument_(body.content, properties);
    }
    if (body.action === 'document_delete') {
      if (!roles.some(role =>
          ['Styrelse', 'Sekreterare', 'Kassör', 'Admin'].includes(role))) {
        return reply_(false, 'insufficient_role');
      }
      return deleteDocument_(body.content, properties);
    }
    if (body.action === 'save_contact' || body.action === 'delete_contact') {
      if (!roles.some(role => ['Styrelse', 'Sekreterare', 'Kassör', 'Admin'].includes(role))) {
        return reply_(false, 'insufficient_role');
      }
      return writeContact_(body.action, body.content, members, spreadsheetId,
        properties);
    }
    if (['tasks', 'create_task', 'complete_task', 'recall_task', 'archive_task'].includes(body.action)) {
      const storeId = properties.getProperty(MESSAGES_SHEET_PROPERTY);
      if (!/^[A-Za-z0-9_-]{20,128}$/.test(storeId || '')) {
        return reply_(false, 'tasks_setup_missing');
      }
      const boardAllowed = roles.some(role =>
        ['Styrelse', 'Sekreterare', 'Kassör', 'Admin'].includes(role));
      if (body.action === 'tasks') {
        return reply_(true, null, { tasks: visibleTasks_(readTaskEvents_(storeId),
          boardAllowed, row[16]) });
      }
      return writeTaskEvent_(storeId, body.action, body.content, row[16],
        row[1], boardAllowed);
    }
    if (body.action === 'profile') {
      return reply_(true, null, {
        associationId: associationId, memberId: row[16],
        name: row[1], roles: roles,
        online: touchPresence_(members, associationId, row[16])
      });
    }
    if (body.action === 'own_fee') {
      const fee = safeAmount_(row[7]);
      const paid = safeAmount_(row[9]);
      if (fee === null || paid === null) {
        return reply_(false, 'test_sheet_invalid');
      }
      return reply_(true, null, {
        memberId: row[16], name: row[1],
        fee: fee, paid: paid, remaining: fee - paid
      });
    }
    if (body.action === 'calendar' || body.action === 'calendar_version') {
      const boardAllowed = roles.some(role =>
        ['Styrelse', 'Sekreterare', 'Kassör', 'Admin'].includes(role));
      const memberCalendarId = properties.getProperty(MEMBER_CALENDAR_PROPERTY);
      const boardCalendarId = properties.getProperty(BOARD_CALENDAR_PROPERTY);
      if (!validCalendarId_(memberCalendarId) ||
          (boardAllowed && !validCalendarId_(boardCalendarId))) {
        return reply_(false, 'calendar_setup_missing');
      }
      if (body.action === 'calendar_version') {
        const version = { member: readCalendarUpdated_(memberCalendarId) };
        if (boardAllowed) version.board = readCalendarUpdated_(boardCalendarId);
        return reply_(true, null, { version: version });
      }
      const now = new Date();
      const memberCalendar = readCalendar_(memberCalendarId, 'member', now);
      const events = memberCalendar.events;
      const version = { member: memberCalendar.updated };
      if (boardAllowed) {
        const boardCalendar = readCalendar_(boardCalendarId, 'board', now);
        events.push(...boardCalendar.events);
        version.board = boardCalendar.updated;
      }
      events.sort((a, b) => a.start.localeCompare(b.start));
      const links = boardAllowed ? {
        member: 'https://calendar.google.com/calendar/u/0/r?cid=' + encodeURIComponent(memberCalendarId),
        board: 'https://calendar.google.com/calendar/u/0/r?cid=' + encodeURIComponent(boardCalendarId)
      } : null;
      return reply_(true, null, { testData: true, events: events, links: links,
        version: version });
    }
    if (body.action === 'treasurer_eko') {
      if (!roles.some(role => role === 'Kassör' || role === 'Admin')) {
        return reply_(false, 'insufficient_role');
      }
      return reply_(true, null, readTreasurerEko_(spreadsheetId));
    }
    if (!roles.some(role => ['Styrelse', 'Sekreterare', 'Kassör', 'Admin'].includes(role))) {
      return reply_(false, 'insufficient_role');
    }
    const finances = readRange_(spreadsheetId, "'Kassabok'!A5:H9");
    if (!finances || finances.length !== 5 ||
        finances[0][0] !== 'Period' ||
        finances[4][0] !== 'Utgående bank' ||
        finances[4][2] !== 'Utgående kontant' ||
        finances[4][4] !== 'Resultat') {
      return reply_(false, 'test_sheet_invalid');
    }
    const bank = safeAmount_(finances[4][1]);
    const cash = safeAmount_(finances[4][3]);
    const result = safeAmount_(finances[4][5]);
    if (typeof finances[0][1] !== 'string' || !finances[0][1] ||
        bank === null || cash === null || result === null) {
      return reply_(false, 'test_sheet_invalid');
    }
    return reply_(true, null, {
      period: finances[0][1], bank: bank, cash: cash, result: result
    });
  } catch (error) {
    const message = String(error && error.message || '');
    const category = /quota|limit exceeded|too many times/i.test(message) ? 'quota'
      : /403|permission|not authorized/i.test(message) ? 'permission'
      : /404|not found/i.test(message) ? 'not_found'
      : /429|rate limit/i.test(message) ? 'rate_limit' : 'other';
    const frame = /\bat ([A-Za-z_][A-Za-z0-9_]*)\([^)]*?:(\d+)(?::\d+)?\)/
      .exec(String(error && error.stack || ''));
    const http = /Sheets API HTTP (\d{3})/.exec(message);
    console.warn('VF data exception: ' + (http ? 'sheets_http_' + http[1] : category) +
      (frame ? ' at ' + frame[1] + ':' + frame[2] : ''));
    return reply_(false, 'data_unavailable');
  }
}

// Hela EKO läses som formaterade, beräknade värden. Inga fil-ID:n eller
// redigeringslänkar lämnas till klienten. Ett för stort svar avvisas helt.
function readTreasurerEko_(spreadsheetId) {
  const token = ScriptApp.getOAuthToken();
  const base = 'https://sheets.googleapis.com/v4/spreadsheets/' + encodeURIComponent(spreadsheetId);
  const metadata = sheetsRequest_(base + '?fields=sheets(properties(title,index,hidden))',
    'get', null, token);
  const sheets = (metadata.sheets || []).map(sheet => sheet.properties)
    .sort((a, b) => a.index - b.index);
  if (!sheets.length || sheets.length > 12 || sheets.some(sheet =>
      typeof sheet.title !== 'string' || !sheet.title || sheet.title.length > 100)) {
    throw new Error('Invalid EKO sheet metadata');
  }
  const query = sheets.map(sheet =>
    'ranges=' + encodeURIComponent("'" + sheet.title.replace(/'/g, "''") + "'")).join('&');
  const values = sheetsRequest_(base + '/values:batchGet?valueRenderOption=FORMATTED_VALUE&' + query,
    'get', null, token);
  if (!Array.isArray(values.valueRanges) || values.valueRanges.length !== sheets.length) {
    throw new Error('Incomplete EKO response');
  }
  let cells = 0;
  const result = sheets.map((sheet, index) => {
    const rows = values.valueRanges[index].values || [];
    if (!Array.isArray(rows) || rows.length > 10000) throw new Error('EKO sheet too large');
    for (const row of rows) {
      if (!Array.isArray(row) || row.length > 100 || row.some(cell =>
          typeof cell !== 'string' || cell.length > 10000)) {
        throw new Error('Invalid EKO cell');
      }
      cells += row.length;
      if (cells > 150000) throw new Error('EKO response too large');
    }
    return { name: sheet.title, hidden: sheet.hidden === true, rows: rows };
  });
  if (JSON.stringify(result).length > 5000000) throw new Error('EKO response too large');
  return { sheets: result };
}

function validCalendarId_(value) {
  return typeof value === 'string' && value.length > 10 && value.length <= 255 &&
    /^[A-Za-z0-9._@-]+$/.test(value);
}

// Manuellt prov i Apps Script-redigeraren. Loggar endast antal testhändelser.
function verifyCalendarAccess() {
  ScriptApp.requireScopes(ScriptApp.AuthMode.FULL, [
    'https://www.googleapis.com/auth/calendar.events.readonly'
  ]);
  const properties = PropertiesService.getScriptProperties();
  const from = new Date();
  const until = new Date(from.getTime() + 366 * 86400000);
  for (const [key, kind] of [
    [MEMBER_CALENDAR_PROPERTY, 'member'], [BOARD_CALENDAR_PROPERTY, 'board']
  ]) {
    const id = properties.getProperty(key);
    if (!validCalendarId_(id)) throw new Error('Kalender-ID saknas: ' + key);
    console.log(kind + ': ' + readCalendar_(id, kind, from, until).events.length + ' testhändelser');
  }
}

function readCalendarUpdated_(calendarId) {
  const url = 'https://www.googleapis.com/calendar/v3/calendars/' +
    encodeURIComponent(calendarId) + '/events?maxResults=1&fields=updated';
  const response = UrlFetchApp.fetch(url, {
    method: 'get', headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true
  });
  if (response.getResponseCode() !== 200) throw new Error('Calendar version read failed');
  const parsed = JSON.parse(response.getContentText());
  if (!parsed || typeof parsed.updated !== 'string' ||
      !Number.isFinite(Date.parse(parsed.updated))) {
    throw new Error('Invalid Calendar version');
  }
  return parsed.updated;
}

function readDriveModified_(fileId) {
  const response = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' +
    encodeURIComponent(fileId) + '?fields=modifiedTime', {
    method: 'get', headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true
  });
  if (response.getResponseCode() !== 200) throw new Error('Drive version read failed');
  const parsed = JSON.parse(response.getContentText());
  if (!parsed || typeof parsed.modifiedTime !== 'string' ||
      !Number.isFinite(Date.parse(parsed.modifiedTime))) throw new Error('Invalid Drive version');
  return parsed.modifiedTime;
}

function readCalendar_(calendarId, kind, from) {
  const events = [];
  let updated = '';
  let pageToken = '';
  for (let page = 0; page < 4; page++) {
    const url = 'https://www.googleapis.com/calendar/v3/calendars/' +
      encodeURIComponent(calendarId) + '/events?singleEvents=true&orderBy=startTime' +
      '&maxResults=250&timeMin=' + encodeURIComponent(from.toISOString()) +
      '&fields=' + encodeURIComponent('items(summary,start,end,status,visibility),nextPageToken,updated') +
      (pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : '');
    const response = UrlFetchApp.fetch(url, {
      method: 'get', headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
      muteHttpExceptions: true
    });
    if (response.getResponseCode() !== 200) {
      let reason = 'unknown';
      try {
        const failure = JSON.parse(response.getContentText());
        reason = String(failure.error && failure.error.errors &&
          failure.error.errors[0] && failure.error.errors[0].reason || reason)
          .replace(/[^A-Za-z_]/g, '').slice(0, 50);
      } catch (_error) { /* Logga aldrig kalenderinnehåll eller token. */ }
      throw new Error('Calendar read failed HTTP ' + response.getResponseCode() +
        ' (' + reason + ')');
    }
    const parsed = JSON.parse(response.getContentText());
    if (!parsed || !Array.isArray(parsed.items)) throw new Error('Invalid Calendar response');
    if (page === 0) {
      if (typeof parsed.updated !== 'string' ||
          !Number.isFinite(Date.parse(parsed.updated))) throw new Error('Invalid Calendar version');
      updated = parsed.updated;
    }
    for (const item of parsed.items) {
      if (item.status === 'cancelled' ||
          (kind === 'member' && ['private', 'confidential'].includes(item.visibility))) continue;
      const start = item.start && (item.start.dateTime || item.start.date);
      const end = item.end && (item.end.dateTime || item.end.date);
      if (typeof start !== 'string' || typeof end !== 'string' ||
          !Number.isFinite(Date.parse(start)) || !Number.isFinite(Date.parse(end)) ||
          Date.parse(end) <= Date.parse(start)) continue;
      const title = typeof item.summary === 'string'
        ? item.summary.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 120) : '';
      events.push({ kind: kind, title: title || 'Namnlös händelse',
        start: start, end: end, allDay: !!item.start.date });
    }
    pageToken = parsed.nextPageToken || '';
    if (!pageToken) return { events: events, updated: updated };
  }
  throw new Error('Calendar result exceeds safe page limit');
}

function readRange_(spreadsheetId, range, allowEmpty) {
  const url = 'https://sheets.googleapis.com/v4/spreadsheets/' +
    encodeURIComponent(spreadsheetId) + '/values/' + encodeURIComponent(range) +
    '?valueRenderOption=UNFORMATTED_VALUE';
  const response = UrlFetchApp.fetch(url, {
    method: 'get', headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true
  });
  if (response.getResponseCode() !== 200) {
    let status = 'unknown';
    let reason = 'unknown';
    try {
      const failure = JSON.parse(response.getContentText()).error;
      status = String(failure.status || status).replace(/[^A-Za-z_]/g, '').slice(0, 50);
      reason = String(failure.errors && failure.errors[0] && failure.errors[0].reason || reason)
        .replace(/[^A-Za-z_]/g, '').slice(0, 50);
    } catch (_error) { /* Logga aldrig innehållet i Google-svaret. */ }
    const detail = response.getContentText();
    const cause = /insufficient authentication scopes/i.test(detail) ? 'scope'
      : /not enabled|has not been used|disabled/i.test(detail) ? 'api_disabled'
      : /does not have permission|permission denied/i.test(detail) ? 'file_permission'
      : /not found/i.test(detail) ? 'file_missing' : 'other';
    console.warn('VF sheets read: ' + response.getResponseCode() +
      ' ' + status + '/' + reason + '/' + cause);
    throw new Error('Sheets API HTTP ' + response.getResponseCode() +
      ' (' + status + '/' + reason + ')');
  }
  const parsed = JSON.parse(response.getContentText());
  if (!parsed || (!Array.isArray(parsed.values) && !(allowEmpty && parsed.values === undefined))) {
    throw new Error('Invalid Sheets response');
  }
  return parsed.values || [];
}

// Skapar en avskild, privat meddelandefil en gång i testägarens Drive.
// Körs manuellt i dataskriptets redigerare; aldrig från en besökares webbsida.
function createMessagesTestStore() {
  const properties = PropertiesService.getScriptProperties();
  if (properties.getProperty(MESSAGES_SHEET_PROPERTY)) throw new Error('Meddelandefil finns redan');
  if (!properties.getProperty(ASSOCIATION_PROPERTY) ||
      !properties.getProperty(SHEET_PROPERTY)) throw new Error('Testföreningen saknas');
  const token = ScriptApp.getOAuthToken();
  let folderId = properties.getProperty(MESSAGES_FOLDER_PROPERTY);
  if (!folderId) {
    const rootId = properties.getProperty(APP_ROOT_FOLDER_PROPERTY);
    if (!/^[A-Za-z0-9_-]{20,128}$/.test(rootId || '')) {
      throw new Error('VF-apps huvudmapp saknas');
    }
    const folder = driveRequest_('https://www.googleapis.com/drive/v3/files?fields=id', 'post',
      { name: 'Appinformation och styrning',
        mimeType: 'application/vnd.google-apps.folder', parents: [rootId] }, token);
    folderId = folder.id;
    if (!/^[A-Za-z0-9_-]{20,128}$/.test(folderId || '')) throw new Error('Mapp-ID saknas');
    properties.setProperty(MESSAGES_FOLDER_PROPERTY, folderId);
  }
  const created = sheetsRequest_('https://sheets.googleapis.com/v4/spreadsheets', 'post', {
    properties: { title: 'VF-APP Information och Chat – ENDAST TESTDATA' },
    sheets: [{ properties: { title: 'Information' } },
      { properties: { title: 'Chat' } }]
  }, token);
  const id = created && created.spreadsheetId;
  if (!/^[A-Za-z0-9_-]{20,128}$/.test(id || '')) throw new Error('Fil-ID saknas');
  const meta = driveRequest_('https://www.googleapis.com/drive/v3/files/' +
    encodeURIComponent(id) + '?fields=parents', 'get', null, token);
  const parents = (meta.parents || []).join(',');
  driveRequest_('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(id) +
    '?addParents=' + encodeURIComponent(folderId) +
    (parents ? '&removeParents=' + encodeURIComponent(parents) : '') + '&fields=id,parents',
    'patch', null, token);
  sheetsRequest_('https://sheets.googleapis.com/v4/spreadsheets/' +
    encodeURIComponent(id) + '/values:batchUpdate', 'post', {
      valueInputOption: 'RAW', data: [
        { range: "'Information'!A1:E1", values: [['ID','Medlems-ID','Namn','Text','Tid']] },
        { range: "'Chat'!A1:E1", values: [['ID','Medlems-ID','Namn','Text','Tid']] }
      ]
    }, token);
  properties.setProperty(MESSAGES_SHEET_PROPERTY, id);
  console.log('Separat meddelandefil skapad i testmappen.');
}

function driveRequest_(url, method, payload, token) {
  const options = { method: method,
    headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true };
  if (payload) { options.contentType = 'application/json'; options.payload = JSON.stringify(payload); }
  const response = UrlFetchApp.fetch(url, options);
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
    throw new Error('Drive-begäran misslyckades: HTTP ' + response.getResponseCode());
  }
  return JSON.parse(response.getContentText());
}

// Körs en gång av ägaren. Rotmappen skapas först i en redan appskapad mapp;
// därefter kan den flyttas till VF-apps huvudmapp utan att byta fil-ID.
function createDocumentFolders() {
  const properties = PropertiesService.getScriptProperties();
  const stagingParent = properties.getProperty(MESSAGES_FOLDER_PROPERTY);
  if (!/^[A-Za-z0-9_-]{20,128}$/.test(stagingParent || '')) {
    throw new Error('Appens befintliga styrmapp saknas');
  }
  const token = ScriptApp.getOAuthToken();
  const create = (name, parent) => {
    const file = driveRequest_('https://www.googleapis.com/drive/v3/files?fields=id',
      'post', { name: name, mimeType: 'application/vnd.google-apps.folder',
        parents: [parent] }, token);
    if (!/^[A-Za-z0-9_-]{20,128}$/.test(file.id || '')) {
      throw new Error('Google gav inget mapp-ID');
    }
    return file.id;
  };
  let root = properties.getProperty(DOCUMENT_ROOT_PROPERTY);
  if (!root) {
    root = create('Dokument', stagingParent);
    properties.setProperty(DOCUMENT_ROOT_PROPERTY, root);
  }
  if (!/^[A-Za-z0-9_-]{20,128}$/.test(root)) throw new Error('Ogiltig dokumentmapp');
  for (const [property, name] of [
    [DOCUMENT_MEMBER_PROPERTY, 'Medlem'], [DOCUMENT_BOARD_PROPERTY, 'Styrelse']
  ]) {
    if (!properties.getProperty(property)) {
      properties.setProperty(property, create(name, root));
    }
  }
  properties.setProperty(DOCUMENT_VERSION_PROPERTY, new Date().toISOString());
  return { root: root, member: properties.getProperty(DOCUMENT_MEMBER_PROPERTY),
    board: properties.getProperty(DOCUMENT_BOARD_PROPERTY), stagingParent: stagingParent };
}

function documentFolders_(properties) {
  const member = properties.getProperty(DOCUMENT_MEMBER_PROPERTY);
  const board = properties.getProperty(DOCUMENT_BOARD_PROPERTY);
  const valid = id => typeof id === 'string' && /^[A-Za-z0-9_-]{20,128}$/.test(id);
  if (!valid(member) || !valid(board) || member === board) {
    throw new Error('Dokumentmapparna är inte klara');
  }
  return { member: member, board: board };
}

function visibleDocuments_(properties, boardAllowed) {
  const folders = documentFolders_(properties);
  const documents = [];
  for (const kind of boardAllowed ? ['member', 'board'] : ['member']) {
    const folder = folders[kind];
    let page = '';
    for (let pageIndex = 0; pageIndex < 11; pageIndex++) {
      const query = "'" + folder + "' in parents and trashed = false";
      const url = 'https://www.googleapis.com/drive/v3/files?q=' +
        encodeURIComponent(query) + '&fields=' +
        encodeURIComponent('nextPageToken,files(id,name,mimeType,size,modifiedTime)') +
        '&pageSize=100' + (page ? '&pageToken=' + encodeURIComponent(page) : '');
      const result = driveRequest_(url, 'get', null, ScriptApp.getOAuthToken());
      if (!Array.isArray(result.files)) throw new Error('Ogiltig dokumentlista');
      for (const file of result.files) {
        if (!/^[A-Za-z0-9_-]{20,128}$/.test(file.id || '') ||
            typeof file.name !== 'string') continue;
        documents.push({ id: file.id, name: file.name.slice(0, 160),
          kind: kind, mimeType: String(file.mimeType || '').slice(0, 120),
          size: Number(file.size || 0), modifiedTime: String(file.modifiedTime || '') });
      }
      if (documents.length > 1000) throw new Error('För många dokument');
      page = result.nextPageToken || '';
      if (!page) break;
      if (pageIndex === 10) throw new Error('För många dokumentsidor');
    }
  }
  documents.sort((left, right) => left.name.localeCompare(right.name, 'sv'));
  return documents;
}

function documentMime_(name) {
  const extension = name.toLowerCase().match(/\.[a-z0-9]{1,8}$/)?.[0] || '';
  return {
    '.pdf': 'application/pdf', '.png': 'image/png',
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
    '.txt': 'text/plain', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.odt': 'application/vnd.oasis.opendocument.text'
  }[extension] || null;
}

function uploadDocument_(content, properties) {
  let input;
  try { input = JSON.parse(content); } catch (_error) { return reply_(false, 'invalid_content'); }
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      Object.keys(input).sort().join(',') !== 'content,kind,name' ||
      !['member', 'board'].includes(input.kind) ||
      typeof input.name !== 'string' || input.name.length > 160 ||
      typeof input.content !== 'string' || input.content.length > 6700000 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(input.content)) {
    return reply_(false, 'invalid_content');
  }
  const name = input.name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ').trim();
  const mimeType = documentMime_(name);
  if (!name || !mimeType) return reply_(false, 'unsupported_document');
  const bytes = Utilities.base64Decode(input.content);
  if (bytes.length < 1 || bytes.length > MAX_DOCUMENT_BYTES) {
    return reply_(false, 'document_too_large');
  }
  const folder = documentFolders_(properties)[input.kind];
  const token = ScriptApp.getOAuthToken();
  const created = driveRequest_('https://www.googleapis.com/drive/v3/files?fields=id',
    'post', { name: name, mimeType: mimeType, parents: [folder] }, token);
  const id = created.id;
  if (!/^[A-Za-z0-9_-]{20,128}$/.test(id || '')) throw new Error('Dokument-ID saknas');
  try {
    const result = UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files/' +
      encodeURIComponent(id) + '?uploadType=media&fields=id', {
        method: 'patch', headers: { Authorization: 'Bearer ' + token },
        contentType: mimeType, payload: bytes, muteHttpExceptions: true
      });
    if (result.getResponseCode() < 200 || result.getResponseCode() >= 300) {
      throw new Error('Dokumentet kunde inte sparas');
    }
  } catch (error) {
    try { driveRequest_('https://www.googleapis.com/drive/v3/files/' +
      encodeURIComponent(id) + '?fields=id', 'patch', { trashed: true }, token); }
    catch (_cleanupError) {}
    throw error;
  }
  properties.setProperty(DOCUMENT_VERSION_PROPERTY,
    new Date().toISOString() + ':' + Utilities.getUuid());
  return reply_(true, null, { saved: true, id: id });
}

function deleteDocument_(id, properties) {
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{20,128}$/.test(id)) {
    return reply_(false, 'invalid_content');
  }
  const folders = documentFolders_(properties);
  const token = ScriptApp.getOAuthToken();
  const file = driveRequest_('https://www.googleapis.com/drive/v3/files/' +
    encodeURIComponent(id) + '?fields=id,parents,trashed', 'get', null, token);
  const parents = Array.isArray(file.parents) ? file.parents : [];
  if (file.trashed || (!parents.includes(folders.member) && !parents.includes(folders.board))) {
    return reply_(false, 'invalid_document');
  }
  const updated = driveRequest_('https://www.googleapis.com/drive/v3/files/' +
    encodeURIComponent(id) + '?fields=id,trashed', 'patch', { trashed: true }, token);
  if (updated.id !== id || updated.trashed !== true) {
    throw new Error('Dokumentet kunde inte tas bort');
  }
  properties.setProperty(DOCUMENT_VERSION_PROPERTY,
    new Date().toISOString() + ':' + Utilities.getUuid());
  return reply_(true, null, { saved: true });
}

function openDocument_(id, subject, associationId, properties) {
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{20,128}$/.test(id)) {
    return reply_(false, 'invalid_content');
  }
  const cached = CacheService.getScriptCache().get('doc-role:' + associationId + ':' + subject);
  if (!cached) return reply_(false, 'authorization_expired');
  let role;
  try { role = JSON.parse(cached); } catch (_error) { return reply_(false, 'authorization_expired'); }
  if (role.eko !== readDriveModified_(properties.getProperty(SHEET_PROPERTY))) {
    return reply_(false, 'authorization_expired');
  }
  const folders = documentFolders_(properties);
  const token = ScriptApp.getOAuthToken();
  const file = driveRequest_('https://www.googleapis.com/drive/v3/files/' +
    encodeURIComponent(id) + '?fields=id,name,mimeType,size,parents,trashed',
    'get', null, token);
  const parents = Array.isArray(file.parents) ? file.parents : [];
  if (file.trashed || (!parents.includes(folders.member) &&
      !(role.board === true && parents.includes(folders.board)))) {
    return reply_(false, 'insufficient_role');
  }
  const size = Number(file.size || 0);
  if (!Number.isFinite(size) || size < 1 || size > MAX_DOCUMENT_BYTES ||
      file.mimeType !== documentMime_(String(file.name || ''))) {
    return reply_(false, 'unsupported_document');
  }
  const response = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' +
    encodeURIComponent(id) + '?alt=media', {
      headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true
    });
  if (response.getResponseCode() !== 200) throw new Error('Dokumentet kunde inte läsas');
  const bytes = response.getContent();
  if (bytes.length !== size) throw new Error('Dokumentstorleken ändrades');
  return reply_(true, null, { name: file.name, mimeType: file.mimeType,
    content: Utilities.base64Encode(bytes) });
}

// Kontaktkort och foton är privata Drive-filer som enbart ägarskriptet läser.
// Besökaren får aldrig ett Drive-ID eller en direktlänk till fotofilen.
function contactFolder_(properties) {
  let id = properties.getProperty(CONTACT_FOLDER_PROPERTY);
  if (id) {
    if (!/^[A-Za-z0-9_-]{20,128}$/.test(id)) throw new Error('Ogiltig kontaktmapp');
    return id;
  }
  const parent = properties.getProperty(APP_ROOT_FOLDER_PROPERTY);
  if (!/^[A-Za-z0-9_-]{20,128}$/.test(parent || '')) throw new Error('VF-apps huvudmapp saknas');
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('Kontaktmappen är upptagen');
  try {
    id = properties.getProperty(CONTACT_FOLDER_PROPERTY);
    if (!id) {
      const created = driveRequest_('https://www.googleapis.com/drive/v3/files?fields=id',
        'post', { name: 'Kontaktkort', mimeType: 'application/vnd.google-apps.folder',
          parents: [parent] }, ScriptApp.getOAuthToken());
      id = created.id;
      if (!/^[A-Za-z0-9_-]{20,128}$/.test(id || '')) throw new Error('Kontaktmappens ID saknas');
      properties.setProperty(CONTACT_FOLDER_PROPERTY, id);
      properties.setProperty(CONTACT_VERSION_PROPERTY, new Date().toISOString());
    }
  } finally { lock.releaseLock(); }
  return id;
}

function contactFiles_(folderId) {
  const all = [];
  let page = '';
  for (let index = 0; index < 10; index++) {
    const query = "'" + folderId + "' in parents and trashed = false";
    const url = 'https://www.googleapis.com/drive/v3/files?q=' +
      encodeURIComponent(query) + '&fields=' +
      encodeURIComponent('nextPageToken,files(id,name,mimeType)') +
      '&pageSize=100' + (page ? '&pageToken=' + encodeURIComponent(page) : '');
    const result = driveRequest_(url, 'get', null, ScriptApp.getOAuthToken());
    if (!Array.isArray(result.files)) throw new Error('Ogiltig kontaktlista');
    all.push(...result.files);
    if (all.length > 1000) throw new Error('För många kontaktfiler');
    page = result.nextPageToken || '';
    if (!page) return all;
  }
  throw new Error('Kontaktlistan är för stor');
}

function contactFileContent_(fileId) {
  const response = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' +
    encodeURIComponent(fileId) + '?alt=media', {
      method: 'get', headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
      muteHttpExceptions: true
    });
  if (response.getResponseCode() !== 200) throw new Error('Kontaktfil kunde inte läsas');
  const text = response.getContentText('UTF-8');
  if (text.length > 60000) throw new Error('Kontaktfilen är för stor');
  return JSON.parse(text);
}

function contactRecords_(properties) {
  const association = properties.getProperty(ASSOCIATION_PROPERTY);
  const cards = [];
  const removed = new Map();
  for (const file of contactFiles_(contactFolder_(properties))) {
    if (file.mimeType !== 'application/json' ||
        !/^[A-Za-z0-9_-]{20,128}$/.test(file.id || '')) continue;
    const data = contactFileContent_(file.id);
    if (!data || data.associationId !== association) throw new Error('Fel förening i kontaktfil');
    if (data.kind === 'removed') {
      if (typeof data.memberId !== 'string' || !data.memberId ||
          removed.has(data.memberId)) throw new Error('Ogiltig borttagningsmarkering');
      removed.set(data.memberId, file.id);
    } else if (data.kind === 'card') {
      if (!/^[0-9a-f-]{36}$/i.test(data.id || '') ||
          typeof data.name !== 'string' || !data.name || data.name.length > 80 ||
          typeof data.description !== 'string' || data.description.length > 400 ||
          typeof data.memberId !== 'string' || data.memberId.length > 80 ||
          typeof data.phone !== 'string' || data.phone.length > 40 ||
          typeof data.email !== 'string' || data.email.length > 120 ||
          typeof data.avatar !== 'string' || data.avatar.length > 18000 ||
          (data.photoId && !/^[A-Za-z0-9_-]{20,128}$/.test(data.photoId))) {
        throw new Error('Ogiltigt kontaktkort');
      }
      cards.push({ ...data, fileId: file.id });
    }
  }
  return { cards: cards, removed: removed };
}

function activeContactMembers_(members) {
  const active = new Map();
  for (const member of members.slice(1)) {
    if (member[20] !== 'Aktiv' || typeof member[16] !== 'string' ||
        !member[16] || typeof member[1] !== 'string' || !member[1]) continue;
    if (active.has(member[16])) throw new Error('Dubblerat medlems-ID');
    active.set(member[16], member);
  }
  return active;
}

function visibleContacts_(members, properties) {
  const active = activeContactMembers_(members);
  const records = contactRecords_(properties);
  const linked = new Set();
  const contacts = [];
  for (const card of records.cards) {
    if (card.memberId && records.removed.has(card.memberId)) continue;
    const member = card.memberId ? active.get(card.memberId) : null;
    if (card.memberId && !member) continue;
    if (card.memberId) {
      if (linked.has(card.memberId)) throw new Error('Dubblerat kontaktkort');
      linked.add(card.memberId);
    }
    contacts.push({ cardId: card.id, memberId: card.memberId,
      name: member ? String(member[1]).slice(0, 80) : card.name,
      phone: member ? String(member[2] || '').slice(0, 40) : card.phone,
      email: member ? String(member[3] || '').slice(0, 120) : card.email,
      description: card.description, avatar: card.avatar });
  }
  for (const [memberId, member] of active) {
    if (linked.has(memberId) || records.removed.has(memberId)) continue;
    contacts.push({ cardId: '', memberId: memberId,
      name: String(member[1]).slice(0, 80),
      phone: String(member[2] || '').slice(0, 40),
      email: String(member[3] || '').slice(0, 120),
      description: '', avatar: '' });
  }
  if (contacts.length > 1000) throw new Error('För många kontakter');
  contacts.sort((left, right) => left.name.localeCompare(right.name, 'sv'));
  return contacts;
}

function touchPresence_(members, associationId, memberId) {
  const cache = CacheService.getScriptCache();
  const activeIds = Array.from(activeContactMembers_(members).keys());
  const keys = activeIds.map(id => 'online:' + associationId + ':' + id);
  cache.put('online:' + associationId + ':' + memberId, '1', 180);
  const values = cache.getAll(keys);
  return keys.filter(key => values[key] === '1').length;
}

function contactFilename_(name, id, extension) {
  const clean = name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ').trim().slice(0, 65);
  return clean + ' - ' + id.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80) + extension;
}

function saveContactFile_(folderId, name, mimeType, bytes, existingId) {
  const token = ScriptApp.getOAuthToken();
  let id = existingId;
  const createdNow = !id;
  if (!id) {
    const created = driveRequest_('https://www.googleapis.com/drive/v3/files?fields=id',
      'post', { name: name, mimeType: mimeType, parents: [folderId] }, token);
    id = created.id;
  } else {
    driveRequest_('https://www.googleapis.com/drive/v3/files/' +
      encodeURIComponent(id) + '?fields=id', 'patch', { name: name }, token);
  }
  if (!/^[A-Za-z0-9_-]{20,128}$/.test(id || '')) throw new Error('Kontaktfilens ID saknas');
  try {
    const result = UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files/' +
      encodeURIComponent(id) + '?uploadType=media&fields=id', {
        method: 'patch', headers: { Authorization: 'Bearer ' + token },
        contentType: mimeType, payload: bytes, muteHttpExceptions: true
      });
    if (result.getResponseCode() < 200 || result.getResponseCode() >= 300) {
      throw new Error('Kontaktfilen kunde inte sparas');
    }
  } catch (error) {
    // En ny Drive-fil utan innehåll får inte förstöra hela kontaktlistan.
    if (createdNow) try { trashContactFile_(id); } catch (_cleanupError) {}
    throw error;
  }
  return id;
}

function trashContactFile_(id) {
  if (!id) return;
  driveRequest_('https://www.googleapis.com/drive/v3/files/' +
    encodeURIComponent(id) + '?fields=id', 'patch', { trashed: true },
    ScriptApp.getOAuthToken());
}

function contactInput_(content, action) {
  let input;
  try { input = JSON.parse(content); } catch (_error) { throw new Error('invalid_content'); }
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('invalid_content');
  const allowed = action === 'delete_contact'
    ? ['cardId', 'memberId']
    : ['cardId', 'memberId', 'name', 'description', 'phone', 'email',
      'photo', 'avatar', 'removePhoto', 'updateEko'];
  if (Object.keys(input).some(key => !allowed.includes(key)) ||
      typeof input.cardId !== 'string' ||
      (input.cardId && !/^[0-9a-f-]{36}$/i.test(input.cardId)) ||
      typeof input.memberId !== 'string' || input.memberId.length > 80) {
    throw new Error('invalid_content');
  }
  if (action === 'delete_contact') return input;
  if (typeof input.name !== 'string' || !input.name.trim() || input.name.length > 80 ||
      typeof input.description !== 'string' || input.description.length > 400 ||
      typeof input.phone !== 'string' || input.phone.length > 40 ||
      typeof input.email !== 'string' || input.email.length > 120 ||
      typeof input.photo !== 'string' || input.photo.length > 125000 ||
      typeof input.avatar !== 'string' || input.avatar.length > 16000 ||
      typeof input.removePhoto !== 'boolean' || typeof input.updateEko !== 'boolean' ||
      (input.photo && (input.removePhoto || !input.avatar)) ||
      (!input.photo && input.avatar) ||
      /[\u0000-\u001f\u007f]/.test(input.name + input.phone + input.email) ||
      !/^[+0-9() .-]*$/.test(input.phone) ||
      (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email))) {
    throw new Error('invalid_content');
  }
  if (input.photo) {
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(input.photo) ||
        !/^[A-Za-z0-9+/]+={0,2}$/.test(input.avatar)) throw new Error('invalid_photo');
    const bytes = Utilities.base64Decode(input.photo);
    const avatar = Utilities.base64Decode(input.avatar);
    if (bytes.length > 90000 || avatar.length > 12000 ||
        (bytes[0] & 255) !== 255 || (bytes[1] & 255) !== 216 ||
        (avatar[0] & 255) !== 255 || (avatar[1] & 255) !== 216) {
      throw new Error('invalid_photo');
    }
  }
  return input;
}

function writeContact_(action, content, members, spreadsheetId, properties) {
  let input;
  try { input = contactInput_(content, action); }
  catch (error) { return reply_(false, error.message === 'invalid_photo' ? 'invalid_photo' : 'invalid_content'); }
  const folder = contactFolder_(properties);
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return reply_(false, 'busy');
  try {
    const records = contactRecords_(properties);
    const active = activeContactMembers_(members);
    const existing = input.cardId
      ? records.cards.find(card => card.id === input.cardId) : null;
    if (input.cardId && !existing) return reply_(false, 'contact_not_found');
    if (existing && existing.memberId && input.memberId !== existing.memberId &&
        action === 'delete_contact') return reply_(false, 'invalid_content');
    if (action === 'delete_contact') {
      const memberId = existing ? existing.memberId : input.memberId;
      if (!existing && (!memberId || !active.has(memberId))) {
        return reply_(false, 'contact_not_found');
      }
      if (memberId && !records.removed.has(memberId)) {
        const marker = { kind: 'removed', associationId: properties.getProperty(ASSOCIATION_PROPERTY),
          memberId: memberId };
        saveContactFile_(folder, contactFilename_('Borttagen', memberId, '.json'),
          'application/json', Utilities.newBlob(JSON.stringify(marker)).getBytes());
      }
      if (existing) {
        trashContactFile_(existing.fileId);
        trashContactFile_(existing.photoId);
      }
      properties.setProperty(CONTACT_VERSION_PROPERTY, new Date().toISOString());
      return reply_(true, null, { saved: true });
    }
    if (input.memberId && !active.has(input.memberId)) return reply_(false, 'member_not_found');
    if (input.memberId && records.cards.some(card => card.memberId === input.memberId &&
        card.id !== existing?.id)) return reply_(false, 'already_linked');
    if (existing && existing.memberId && input.memberId !== existing.memberId) {
      return reply_(false, 'cannot_relink');
    }
    const newlyLinked = !!input.memberId && (!existing || !existing.memberId);
    const member = input.memberId ? active.get(input.memberId) : null;
    const name = member ? String(member[1]).slice(0, 80) : input.name.trim();
    const id = existing?.id || Utilities.getUuid();
    const photoId = input.photo
      ? saveContactFile_(folder, contactFilename_(name, input.memberId || id, '.jpg'),
        'image/jpeg', Utilities.base64Decode(input.photo))
      : input.removePhoto ? '' : existing?.photoId || '';
    const card = { kind: 'card', associationId: properties.getProperty(ASSOCIATION_PROPERTY),
      id: id, memberId: input.memberId, name: name,
      description: input.description.trim(),
      phone: member ? '' : input.phone.trim(), email: member ? '' : input.email.trim(),
      photoId: photoId,
      avatar: input.photo ? input.avatar : input.removePhoto ? '' : existing?.avatar || '' };
    const filename = contactFilename_(name, input.memberId || id, '.json');
    let savedFileId = '';
    try {
      // Drive-kortet måste finnas innan EKO ändras. Vid fel i Sheets återställs
      // kortet, så att användaren inte får ett lyckat kort med gamla EKO-fält.
      savedFileId = saveContactFile_(folder, filename, 'application/json',
        Utilities.newBlob(JSON.stringify(card)).getBytes(), existing?.fileId);
      if (member && (!newlyLinked || input.updateEko) &&
          (input.phone !== String(member[2] || '') ||
            input.email !== String(member[3] || ''))) {
        const index = members.indexOf(member) + 11;
        sheetsRequest_('https://sheets.googleapis.com/v4/spreadsheets/' +
          encodeURIComponent(spreadsheetId) + '/values:batchUpdate', 'post', {
            valueInputOption: 'RAW', data: [
              { range: "'Medlemmar'!C" + index + ':D' + index,
                values: [[input.phone.trim(), input.email.trim()]] }
            ]
          }, ScriptApp.getOAuthToken());
      }
    } catch (error) {
      try {
        if (existing) {
          const original = { ...existing };
          delete original.fileId;
          saveContactFile_(folder, contactFilename_(existing.name,
            existing.memberId || existing.id, '.json'), 'application/json',
            Utilities.newBlob(JSON.stringify(original)).getBytes(), existing.fileId);
        } else if (savedFileId) trashContactFile_(savedFileId);
        if (photoId && photoId !== existing?.photoId) trashContactFile_(photoId);
      } catch (_rollbackError) {
        throw new Error('Kontaktkortet kunde inte återställas efter ett fel');
      }
      throw error;
    }
    // Dessa filer läses inte längre. Ett städningsfel får inte ändra utfallet
    // efter att både kontaktkortet och eventuella EKO-fält har sparats.
    if (existing && existing.photoId && existing.photoId !== photoId) {
      try { trashContactFile_(existing.photoId); } catch (_cleanupError) {}
    }
    if (input.memberId && records.removed.has(input.memberId)) {
      trashContactFile_(records.removed.get(input.memberId));
    }
    properties.setProperty(CONTACT_VERSION_PROPERTY, new Date().toISOString());
    return reply_(true, null, { saved: true, cardId: id });
  } finally { lock.releaseLock(); }
}

function readMessages_(id, sheet) {
  const rows = readRange_(id, "'" + sheet + "'!A1:E1001");
  if (!rows[0] || rows[0].join('|') !== 'ID|Medlems-ID|Namn|Text|Tid') {
    throw new Error('Meddelandefilens format är fel');
  }
  return rows.slice(1).filter(row => row[0] && row[3] && row[4]);
}

function visibleMessage_(row) {
  return { id: String(row[0]), name: String(row[2]).slice(0,80),
    text: String(row[3]), createdAt: String(row[4]) };
}

function readInformationRows_(id) {
  const rows = readRange_(id, "'Information'!A1:F1001");
  if (!rows[0] || rows[0].slice(0, 5).join('|') !== 'ID|Medlems-ID|Namn|Text|Tid' ||
      (rows[0][5] && rows[0][5] !== 'Borttagen')) {
    throw new Error('Informationsfilens format är fel');
  }
  return rows;
}

function readInformation_(id, includeHistory) {
  const rows = readInformationRows_(id).slice(1).filter(row =>
    row[0] && row[3] && row[4] && !row[5]);
  const result = { message: rows.length ? visibleMessage_(rows[rows.length - 1]) : null };
  if (includeHistory) result.messages = rows.map(visibleMessage_).reverse();
  return result;
}

function deleteInformation_(id, messageId, memberId) {
  if (!/^[0-9a-f-]{36}$/i.test(messageId)) return reply_(false, 'invalid_content');
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return reply_(false, 'busy');
  try {
    const rows = readInformationRows_(id);
    const matches = rows.map((row, index) => ({ row, index }))
      .filter(item => item.index > 0 && item.row[0] === messageId);
    if (matches.length !== 1) return reply_(false, 'message_not_found');
    if (matches[0].row[5]) return reply_(false, 'already_deleted');
    const rowNumber = matches[0].index + 1;
    sheetsRequest_('https://sheets.googleapis.com/v4/spreadsheets/' +
      encodeURIComponent(id) + '/values:batchUpdate', 'post', {
        valueInputOption: 'RAW', data: [
          { range: "'Information'!F1", values: [['Borttagen']] },
          { range: "'Information'!F" + rowNumber,
            values: [[memberId + ' · ' + new Date().toISOString()]] }
        ]
      }, ScriptApp.getOAuthToken());
    return reply_(true, null, { saved: true });
  } finally { lock.releaseLock(); }
}

function readChat_(id) {
  return { messages: readMessages_(id, 'Chat').slice(-50).map(visibleMessage_) };
}

function appendMessage_(id, sheet, content, memberId, name) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw new Error('Meddelandefilen är upptagen');
  try {
    if (readMessages_(id, sheet).length >= 1000) throw new Error('Testgräns för meddelanden nådd');
    const range = "'" + sheet + "'!A:E";
    sheetsRequest_('https://sheets.googleapis.com/v4/spreadsheets/' +
      encodeURIComponent(id) + '/values/' + encodeURIComponent(range) +
      ':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', 'post', {
        values: [[Utilities.getUuid(), memberId, name, content, new Date().toISOString()]]
      }, ScriptApp.getOAuthToken());
  } finally { lock.releaseLock(); }
}

// Ett händelseregister i appens privata Drive-fil. Ingen medlems- eller
// ekonomirad i EKO ändras av att-göra-listan.
const TASK_HEADER = ['Händelse-ID', 'Uppgift-ID', 'Lista', 'Händelse',
  'Uppgift', 'Medlems-ID', 'Namn', 'Tid', 'Orsak'];

// Engångssteg för den befintliga privata testfilen; körs av ägaren i redigeraren.
function prepareTaskStore() {
  const id = PropertiesService.getScriptProperties().getProperty(MESSAGES_SHEET_PROPERTY);
  if (!/^[A-Za-z0-9_-]{20,128}$/.test(id || '')) throw new Error('Privat appfil saknas');
  const token = ScriptApp.getOAuthToken();
  const metadata = sheetsRequest_('https://sheets.googleapis.com/v4/spreadsheets/' +
    encodeURIComponent(id) + '?fields=sheets.properties.title', 'get', null, token);
  if (!metadata.sheets.some(sheet => sheet.properties.title === 'Uppgifter')) {
    sheetsRequest_('https://sheets.googleapis.com/v4/spreadsheets/' +
      encodeURIComponent(id) + ':batchUpdate', 'post', {
        requests: [{ addSheet: { properties: { title: 'Uppgifter' } } }]
      }, token);
  }
  const existing = readRange_(id, "'Uppgifter'!A1:I1", true);
  if (existing.length && existing[0].length) {
    if (existing[0].join('|') !== TASK_HEADER.join('|')) throw new Error('Fel uppgiftsformat');
    return;
  }
  sheetsRequest_('https://sheets.googleapis.com/v4/spreadsheets/' +
    encodeURIComponent(id) + '/values/\'Uppgifter\'!A1:I1?valueInputOption=RAW',
    'put', { values: [TASK_HEADER] }, token);
}

function readTaskEvents_(id) {
  const rows = readRange_(id, "'Uppgifter'!A1:I1001");
  if (!rows[0] || rows[0].join('|') !== TASK_HEADER.join('|')) {
    throw new Error('Uppgiftsfilens format är fel');
  }
  return rows.slice(1).filter(row => row[0] && row[1] && row[3]);
}

function taskStates_(events) {
  const tasks = new Map();
  for (const row of events) {
    const [eventId, taskId, scope, event, title, memberId, name, at] = row;
    if (!/^[0-9a-f-]{36}$/i.test(String(eventId)) ||
        !/^[0-9a-f-]{36}$/i.test(String(taskId)) ||
        !['medlem', 'styrelse', 'prioriterad'].includes(scope) ||
        !['skapad', 'utförd', 'återkallad', 'arkiverad'].includes(event) ||
        typeof memberId !== 'string' || !memberId ||
        typeof name !== 'string' || !name ||
        typeof at !== 'string' || !Number.isFinite(Date.parse(at))) {
      throw new Error('Fel i uppgiftsloggen');
    }
    if (event === 'skapad') {
      if (tasks.has(taskId) || typeof title !== 'string' || !title || title.length > 100) {
        throw new Error('Dubblerad eller ogiltig uppgift');
      }
      tasks.set(taskId, { id: taskId, kind: scope, text: title, done: false,
        completedBy: null, completedAt: null, lastRecall: null, archived: false });
      continue;
    }
    const task = tasks.get(taskId);
    if (!task || task.kind !== scope || task.archived ||
        (event === 'utförd' && task.done) ||
        (event === 'återkallad' && (!task.done || task.completedBy?.memberId !== memberId || row[8] !== 'felaktig')) ||
        (event === 'arkiverad' && (!task.done || row[8] !== 'godkänd'))) {
      throw new Error('Motsägande uppgiftshistorik');
    }
    if (event === 'utförd') {
      task.done = true;
      task.completedBy = { memberId: memberId, name: name };
      task.completedAt = at;
      task.lastRecall = null;
    } else if (event === 'återkallad') {
      task.done = false;
      task.completedBy = null;
      task.completedAt = null;
      task.lastRecall = { name: name, at: at, reason: 'felaktig' };
    } else {
      task.archived = true;
      task.archivedBy = { memberId: memberId, name: name, at: at };
    }
  }
  return tasks;
}

function visibleTasks_(events, boardAllowed, viewerId) {
  return Array.from(taskStates_(events).values())
    .filter(task => !task.archived && (boardAllowed || task.kind !== 'styrelse'))
    .map(task => ({ id: task.id, kind: task.kind, text: task.text,
      done: task.done, completedBy: task.completedBy?.name || null,
      completedAt: task.completedAt,
      canRecall: task.done && task.completedBy?.memberId === viewerId,
      lastRecall: task.lastRecall }));
}

function writeTaskEvent_(id, action, content, memberId, name, boardAllowed) {
  let scope = null;
  let title = '';
  let taskId = '';
  if (action === 'create_task') {
    if (!boardAllowed) return reply_(false, 'insufficient_role');
    try {
      const input = JSON.parse(content);
      if (!input || Object.keys(input).sort().join(',') !== 'kind,text' ||
          !['medlem', 'styrelse', 'prioriterad'].includes(input.kind) ||
          typeof input.text !== 'string') return reply_(false, 'invalid_content');
      scope = input.kind;
      title = input.text.trim();
    } catch (_error) { return reply_(false, 'invalid_content'); }
    if (!title || title.length > 100 || /[\u0000-\u001f\u007f]/.test(title)) {
      return reply_(false, 'invalid_content');
    }
  } else {
    if (action === 'archive_task' && !boardAllowed) return reply_(false, 'insufficient_role');
    taskId = content;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(taskId)) {
      return reply_(false, 'invalid_content');
    }
  }
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return reply_(false, 'busy');
  try {
    const events = readTaskEvents_(id);
    if (events.length >= 1000) return reply_(false, 'tasks_limit_reached');
    const states = taskStates_(events);
    if (action !== 'create_task') {
      const task = states.get(taskId);
      if (!task || task.archived || (!boardAllowed && task.kind === 'styrelse')) {
        return reply_(false, 'task_not_found');
      }
      if (action === 'complete_task' && task.done) return reply_(false, 'already_completed');
      if (action === 'recall_task' && (!task.done || task.completedBy.memberId !== memberId)) {
        return reply_(false, 'recall_denied');
      }
      if (action === 'archive_task' && !task.done) return reply_(false, 'not_completed');
      scope = task.kind;
    } else {
      taskId = Utilities.getUuid();
    }
    const event = action === 'create_task' ? 'skapad' :
      action === 'complete_task' ? 'utförd' :
        action === 'recall_task' ? 'återkallad' : 'arkiverad';
    sheetsRequest_('https://sheets.googleapis.com/v4/spreadsheets/' +
      encodeURIComponent(id) + '/values/%27Uppgifter%27!A:I:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS',
      'post', { values: [[Utilities.getUuid(), taskId, scope, event, title,
        memberId, name, new Date().toISOString(),
        action === 'recall_task' ? 'felaktig' : action === 'archive_task' ? 'godkänd' : '']] },
      ScriptApp.getOAuthToken());
    return reply_(true, null, { saved: true, taskId: taskId });
  } finally { lock.releaseLock(); }
}

function safeAmount_(value) {
  return typeof value === 'number' && Number.isFinite(value) &&
    Math.abs(value) <= 100000000 ? value : null;
}

function sameBytes_(left, right) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index++) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function reply_(allowed, reason, data) {
  if (!allowed) {
    console.warn('VF data response: ' +
      (/^[a-z_]{3,40}$/.test(reason) ? reason : 'other'));
  }
  const result = allowed ? { allowed: true, data: data } : { allowed: false, reason: reason };
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}
