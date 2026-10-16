// ENDAST TESTDATA. Webbappen kör som testfilens ägare och läser en fil vars ID
// ligger i Script Properties. Inga riktiga medlems- eller ekonomidata får anges.
const ASSOCIATION_PROPERTY = 'VF_TEST_ASSOCIATION_ID';
const KEY_PROPERTY = 'VF_TEST_BRIDGE_KEY';
const SHEET_PROPERTY = 'VF_TEST_SPREADSHEET_ID';
const MEMBER_CALENDAR_PROPERTY = 'VF_MEMBER_CALENDAR_ID';
const BOARD_CALENDAR_PROPERTY = 'VF_BOARD_CALENDAR_ID';
const MESSAGES_SHEET_PROPERTY = 'VF_TEST_MESSAGES_SHEET_ID';
const MESSAGES_FOLDER_PROPERTY = 'VF_TEST_MESSAGES_FOLDER_ID';
const MAX_AGE_MS = 120000;

function doGet() {
  return ContentService.createTextOutput('VF privat läsprov – endast låtsasdata');
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
    if (typeof raw !== 'string' || raw.length > 4096) return reply_(false, 'invalid_request');
    const envelope = JSON.parse(raw);
    if (!envelope || typeof envelope.body !== 'string' || typeof envelope.mac !== 'string' ||
        envelope.body.length > 4096 || !/^[A-Za-z0-9_-]{43}$/.test(envelope.mac)) {
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
    const writeAction = ['publish_information', 'post_chat', 'create_task',
      'complete_task', 'recall_task'].includes(body.action);
    const expectedKeys = hasContent
      ? 'action,associationId,content,nonce,subject,ts,v'
      : 'action,associationId,nonce,subject,ts,v';
    if (Object.keys(body).sort().join(',') !== expectedKeys) return reply_(false, 'wrong_association_or_action');
    if (body.v !== 1 || body.associationId !== associationId) return reply_(false, 'wrong_association_or_action');
    if (!['profile', 'own_fee', 'board_summary', 'calendar', 'calendar_version', 'information', 'chat',
          'publish_information', 'post_chat', 'tasks', 'contacts',
          'create_task', 'complete_task', 'recall_task'].includes(body.action)) return reply_(false, 'wrong_association_or_action');
    if (typeof body.subject !== 'string' || !body.subject || body.subject.length > 255) return reply_(false, 'wrong_association_or_action');
    if (typeof body.nonce !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.nonce)) return reply_(false, 'wrong_association_or_action');
    if (writeAction !== hasContent ||
        (hasContent && (typeof body.content !== 'string' || body.content.length > 600))) {
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
        typeof row[16] !== 'string' || !row[16] ||
        typeof row[1] !== 'string' || !row[1]) {
      return reply_(false, 'test_sheet_invalid');
    }
    if (['information', 'chat', 'publish_information', 'post_chat'].includes(body.action)) {
      const messagesId = properties.getProperty(MESSAGES_SHEET_PROPERTY);
      if (!/^[A-Za-z0-9_-]{20,128}$/.test(messagesId || '')) {
        return reply_(false, 'messages_setup_missing');
      }
      if (body.action === 'information') return reply_(true, null, readInformation_(messagesId));
      if (body.action === 'chat') return reply_(true, null, readChat_(messagesId));
      if (body.action === 'publish_information' &&
          !roles.some(role => ['Styrelse', 'Sekreterare', 'Kassör', 'Admin'].includes(role))) {
        return reply_(false, 'insufficient_role');
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
    if (body.action === 'contacts') {
      const contacts = members.slice(1).filter(member => member[20] === 'Aktiv' &&
        typeof member[16] === 'string' && member[16] &&
        typeof member[1] === 'string' && member[1]).map(member => ({
          memberId: member[16], name: member[1].slice(0, 80),
          phone: String(member[2] || '').slice(0, 40),
          email: String(member[3] || '').slice(0, 120)
        }));
      if (contacts.length > 1000) return reply_(false, 'too_many_contacts');
      contacts.sort((a, b) => a.name.localeCompare(b.name, 'sv'));
      return reply_(true, null, { contacts: contacts });
    }
    if (['tasks', 'create_task', 'complete_task', 'recall_task'].includes(body.action)) {
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
        name: row[1], roles: roles
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
  } catch (_error) {
    return reply_(false, 'data_unavailable');
  }
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
  if (response.getResponseCode() !== 200) throw new Error('Sheets read failed');
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
    const folder = driveRequest_('https://www.googleapis.com/drive/v3/files?fields=id', 'post',
      { name: 'VF-APP meddelanden – ENDAST TESTDATA',
        mimeType: 'application/vnd.google-apps.folder' }, token);
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

function readInformation_(id) {
  const rows = readMessages_(id, 'Information');
  return { message: rows.length ? visibleMessage_(rows[rows.length - 1]) : null };
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
        !['skapad', 'utförd', 'återkallad'].includes(event) ||
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
        completedBy: null, completedAt: null, lastRecall: null });
      continue;
    }
    const task = tasks.get(taskId);
    if (!task || task.kind !== scope || (event === 'utförd' && task.done) ||
        (event === 'återkallad' && (!task.done || task.completedBy?.memberId !== memberId || row[8] !== 'felaktig'))) {
      throw new Error('Motsägande uppgiftshistorik');
    }
    if (event === 'utförd') {
      task.done = true;
      task.completedBy = { memberId: memberId, name: name };
      task.completedAt = at;
      task.lastRecall = null;
    } else {
      task.done = false;
      task.completedBy = null;
      task.completedAt = null;
      task.lastRecall = { name: name, at: at, reason: 'felaktig' };
    }
  }
  return tasks;
}

function visibleTasks_(events, boardAllowed, viewerId) {
  return Array.from(taskStates_(events).values())
    .filter(task => boardAllowed || task.kind !== 'styrelse')
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
      if (!task || (!boardAllowed && task.kind === 'styrelse')) {
        return reply_(false, 'task_not_found');
      }
      if (action === 'complete_task' && task.done) return reply_(false, 'already_completed');
      if (action === 'recall_task' && (!task.done || task.completedBy.memberId !== memberId)) {
        return reply_(false, 'recall_denied');
      }
      scope = task.kind;
    } else {
      taskId = Utilities.getUuid();
    }
    const event = action === 'create_task' ? 'skapad' :
      action === 'complete_task' ? 'utförd' : 'återkallad';
    sheetsRequest_('https://sheets.googleapis.com/v4/spreadsheets/' +
      encodeURIComponent(id) + '/values/%27Uppgifter%27!A:I:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS',
      'post', { values: [[Utilities.getUuid(), taskId, scope, event, title,
        memberId, name, new Date().toISOString(), action === 'recall_task' ? 'felaktig' : '']] },
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
  const result = allowed ? { allowed: true, data: data } : { allowed: false, reason: reason };
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}
