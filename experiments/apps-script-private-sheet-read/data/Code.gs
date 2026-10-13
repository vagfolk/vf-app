// ENDAST TESTDATA. Webbappen kör som testfilens ägare och läser en fil vars ID
// ligger i Script Properties. Inga riktiga medlems- eller ekonomidata får anges.
const ASSOCIATION_PROPERTY = 'VF_TEST_ASSOCIATION_ID';
const KEY_PROPERTY = 'VF_TEST_BRIDGE_KEY';
const SHEET_PROPERTY = 'VF_TEST_SPREADSHEET_ID';
const MEMBER_CALENDAR_PROPERTY = 'VF_MEMBER_CALENDAR_ID';
const BOARD_CALENDAR_PROPERTY = 'VF_BOARD_CALENDAR_ID';
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
  const response = UrlFetchApp.fetch(url, {
    method: method, contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify(payload), muteHttpExceptions: true
  });
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
        envelope.body.length > 2048 || !/^[A-Za-z0-9_-]{43}$/.test(envelope.mac)) {
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
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
        Object.keys(body).sort().join(',') !== 'action,associationId,nonce,subject,ts,v' ||
        body.v !== 1 || body.associationId !== associationId ||
        !['profile', 'own_fee', 'board_summary', 'calendar'].includes(body.action) ||
        typeof body.subject !== 'string' || !body.subject || body.subject.length > 255 ||
        typeof body.nonce !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.nonce)) {
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
    if (body.action === 'calendar') {
      const boardAllowed = roles.some(role =>
        ['Styrelse', 'Sekreterare', 'Kassör', 'Admin'].includes(role));
      const memberCalendarId = properties.getProperty(MEMBER_CALENDAR_PROPERTY);
      const boardCalendarId = properties.getProperty(BOARD_CALENDAR_PROPERTY);
      if (!validCalendarId_(memberCalendarId) ||
          (boardAllowed && !validCalendarId_(boardCalendarId))) {
        return reply_(false, 'calendar_setup_missing');
      }
      const now = new Date();
      const until = new Date(now.getTime() + 366 * 86400000);
      const events = readCalendar_(memberCalendarId, 'member', now, until);
      if (boardAllowed) {
        events.push(...readCalendar_(boardCalendarId, 'board', now, until));
      }
      events.sort((a, b) => a.start.localeCompare(b.start));
      const links = boardAllowed ? {
        member: 'https://calendar.google.com/calendar/u/0/r?cid=' + encodeURIComponent(memberCalendarId),
        board: 'https://calendar.google.com/calendar/u/0/r?cid=' + encodeURIComponent(boardCalendarId)
      } : null;
      return reply_(true, null, { testData: true, events: events, links: links });
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
    console.log(kind + ': ' + readCalendar_(id, kind, from, until).length + ' testhändelser');
  }
}

function readCalendar_(calendarId, kind, from, until) {
  const events = [];
  let pageToken = '';
  for (let page = 0; page < 4; page++) {
    const url = 'https://www.googleapis.com/calendar/v3/calendars/' +
      encodeURIComponent(calendarId) + '/events?singleEvents=true&orderBy=startTime' +
      '&maxResults=250&timeMin=' + encodeURIComponent(from.toISOString()) +
      '&timeMax=' + encodeURIComponent(until.toISOString()) +
      '&fields=' + encodeURIComponent('items(summary,start,end,status,visibility),nextPageToken') +
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
    if (!pageToken) return events;
  }
  throw new Error('Calendar result exceeds safe page limit');
}

function readRange_(spreadsheetId, range) {
  const url = 'https://sheets.googleapis.com/v4/spreadsheets/' +
    encodeURIComponent(spreadsheetId) + '/values/' + encodeURIComponent(range) +
    '?valueRenderOption=UNFORMATTED_VALUE';
  const response = UrlFetchApp.fetch(url, {
    method: 'get', headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true
  });
  if (response.getResponseCode() !== 200) throw new Error('Sheets read failed');
  const parsed = JSON.parse(response.getContentText());
  if (!parsed || !Array.isArray(parsed.values)) throw new Error('Invalid Sheets response');
  return parsed.values;
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
