import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const root = new URL('../experiments/apps-script-private-sheet-read/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('data/appsscript.json', root), 'utf8'));
const key = Buffer.alloc(32, 19);
const keyText = key.toString('base64url');
const association = 'VF-TEST-2026';
const fileId = 'FAKE_TEST_SPREADSHEET_ID_1234567890';
const memberCalendarId = 'member-test@group.calendar.google.com';
const boardCalendarId = 'board-test@group.calendar.google.com';
const memberHead = ['Nr', 'Namn', 'Telefon', 'E-post', 'Medlemstyp', 'Familje-ID',
  'Avgiftsskyldig?', 'Avgift', 'Egen avgift', 'Inbetalt belopp', 'Betalstatus',
  'Betalsätt', 'Betald datum', 'Radstatus', 'Kommentar', 'Betalningsreferens',
  'Medlems-ID', 'Google-konto-ID', 'Approll', 'Extra approll', 'Appstatus'];
const financeRows = [
  ['Period', '2026-01-01 – 2026-12-31'],
  ['Ingående bank', 0, 'Ingående kontant', 0],
  ['Inkomst bank/Swish', 800, 'Inkomst kontant', 200],
  ['Utgift bank/Swish', 0, 'Utgift kontant', 0],
  ['Utgående bank', 1250, 'Utgående kontant', 80, 'Resultat', 450]
];

function memberRow({ sub, role = 'Medlem', status = 'Aktiv', name, id, fee = 300, paid = 100, extra = '' }) {
  const row = Array(21).fill('');
  row[1] = name;
  row[7] = fee;
  row[9] = paid;
  row[16] = id;
  row[17] = sub;
  row[18] = role;
  row[19] = extra;
  row[20] = status;
  return row;
}

function utilities() {
  return {
    base64DecodeWebSafe: value => Array.from(Buffer.from(value, 'base64url')),
    base64EncodeWebSafe: value => Buffer.from(value.map(item => item & 255)).toString('base64url'),
    computeHmacSha256Signature: (body, secret) => {
      assert.equal(Array.isArray(body), true);
      assert.equal(Array.isArray(secret), true);
      return Array.from(createHmac('sha256', Buffer.from(secret)).update(Buffer.from(body)).digest());
    },
    getUuid: randomUUID,
    newBlob: value => ({
      getBytes: () => Array.from(Buffer.from(value, 'utf8')),
      getDataAsString: () => Buffer.from(value).toString('utf8')
    })
  };
}

function properties(values) {
  return { getScriptProperties: () => ({ getProperty: name => values.get(name) ?? null }) };
}

function reply(value, status = 200, headers = {}) {
  return { getResponseCode: () => status, getContentText: () => JSON.stringify(value),
    getAllHeaders: () => headers };
}

function fixture({ members, finance, failSheet = false,
  failCalendar = false,
  authorizationMissing = false, bridgeStatus = 200,
  redirectCodes = null, redirectLocation =
    'https://script.googleusercontent.com/macros/echo?user_content_key=TEST' } = {}) {
  const rows = members ?? [memberHead,
    memberRow({ sub: 'google-member', name: 'Testmedlem', id: 'M-001' }),
    memberRow({ sub: 'google-board', role: 'Styrelse', name: 'Teststyrelse', id: 'M-002', paid: 300 })];
  const cash = finance ?? financeRows;
  const dataProperties = new Map([
    ['VF_TEST_ASSOCIATION_ID', association],
    ['VF_TEST_BRIDGE_KEY', keyText],
    ['VF_TEST_SPREADSHEET_ID', fileId],
    ['VF_MEMBER_CALENDAR_ID', memberCalendarId],
    ['VF_BOARD_CALENDAR_ID', boardCalendarId]
  ]);
  const identityProperties = new Map([
    ['VF_TEST_ASSOCIATION_ID', association],
    ['VF_TEST_BRIDGE_KEY', keyText],
    ['VF_TEST_DATA_URL', 'https://script.google.com/macros/s/TEST/exec']
  ]);
  let subject = 'google-member';
  const seenNonces = new Set();
  const sheetReads = [];
  const calendarReads = [];
  const informationRows = [['ID','Medlems-ID','Namn','Text','Tid']];
  const chatRows = [['ID','Medlems-ID','Namn','Text','Tid']];
  dataProperties.set('VF_TEST_MESSAGES_SHEET_ID', 'messages-test-file-aaaaaaaaaaaaaa');
  let forwarded = 0;
  let redirectFetches = 0;
  let requiredScopeChecks = 0;
  let bridgeResult;
  const data = {
    PropertiesService: properties(dataProperties), Utilities: utilities(),
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
    CacheService: { getScriptCache: () => ({
      get: nonce => seenNonces.has(nonce) ? '1' : null,
      put: nonce => seenNonces.add(nonce)
    }) },
    ContentService: { MimeType: { JSON: 'JSON' },
      createTextOutput: value => ({ value, setMimeType() { return this; } }) },
    ScriptApp: { getOAuthToken: () => 'fake-readonly-token' },
    UrlFetchApp: { fetch: (url, options) => {
      if (url.startsWith('https://www.googleapis.com/calendar/v3/calendars/')) {
        assert.equal(options.headers.Authorization, 'Bearer fake-readonly-token');
        calendarReads.push(url);
        if (failCalendar) return reply({ error: 'unavailable' }, 403);
        const id = decodeURIComponent(new URL(url).pathname.split('/calendars/')[1].split('/events')[0]);
        const title = id === memberCalendarId ? 'Test medlemsmöte' : 'Test styrelsemöte';
        return reply({ items: [{ summary: title,
          description: 'Får inte lämna servern', attendees: [{ email: 'private@example.invalid' }],
          start: { dateTime: '2026-11-01T18:00:00+01:00' },
          end: { dateTime: '2026-11-01T19:00:00+01:00' } },
          ...(id === memberCalendarId ? [{ summary: 'Privat testmöte', visibility: 'private',
            start: { dateTime: '2026-11-02T18:00:00+01:00' },
            end: { dateTime: '2026-11-02T19:00:00+01:00' } }] : [])] });
      }
      assert.match(url, /^https:\/\/sheets\.googleapis\.com\/v4\/spreadsheets\//);
      assert.equal(options.headers.Authorization, 'Bearer fake-readonly-token');
      sheetReads.push(url);
      if (failSheet) return reply({ error: 'unavailable' }, 403);
      const range = decodeURIComponent(new URL(url).pathname.split('/values/')[1]);
      if (range.startsWith("'Information'") || range.startsWith("'Chat'")) {
        const target = range.startsWith("'Information'") ? informationRows : chatRows;
        if (options.method === 'post') {
          target.push(...JSON.parse(options.payload).values);
          return reply({ updates: { updatedRows: 1 } });
        }
        return reply({ values: target });
      }
      return reply({ values: range.startsWith("'Medlemmar'") ? rows : cash });
    } },
    Date, JSON, Math, Number, Object, Array
  };
  runInNewContext(readFileSync(new URL('data/Code.gs', root), 'utf8'), data);
  const identity = {
    PropertiesService: properties(identityProperties),
    Utilities: { ...utilities(), sleep() {} },
    console: { warn() {} },
    HtmlService: {
      createHtmlOutputFromFile: name => ({
        name, setTitle(title) { this.title = title; return this; }
      }),
      createHtmlOutput: html => ({
        html, setTitle(title) { this.title = title; return this; }
      })
    },
    ScriptApp: { AuthMode: { FULL: 'FULL' },
      getService: () => ({ getUrl: () => 'https://script.google.com/macros/s/TEST/exec' }),
      AuthorizationStatus: { REQUIRED: 'REQUIRED' },
      requireAllScopes: mode => {
        assert.equal(mode, 'FULL');
        requiredScopeChecks++;
      },
      getAuthorizationInfo: (_mode, scopes) => {
        assert.deepEqual(Array.from(scopes),
          ['https://www.googleapis.com/auth/script.external_request']);
        return {
          getAuthorizationStatus: () => authorizationMissing ? 'REQUIRED' : 'NOT_REQUIRED',
          getAuthorizationUrl: () => authorizationMissing
            ? 'https://accounts.google.com/test-authorization' : null
        };
      },
      getIdentityToken: () => {
      const payload = Buffer.from(JSON.stringify({ sub: subject })).toString('base64url');
      return `header.${payload}.signature`;
    } },
    UrlFetchApp: { fetch: (_url, options) => {
      if (_url === 'https://script.google.com/macros/s/TEST/exec') {
        forwarded++;
        if (bridgeStatus !== 200) return reply({ error: 'bridge failure' }, bridgeStatus);
        bridgeResult = JSON.parse(data.doPost({ postData: { contents: options.payload } }).value);
        return redirectCodes ? reply({}, 302, { Location: redirectLocation })
          : reply(bridgeResult);
      }
      assert.equal(_url, redirectLocation);
      assert.equal(options.method, 'get');
      redirectFetches++;
      const status = redirectCodes[Math.min(redirectFetches - 1, redirectCodes.length - 1)];
      return reply(status === 200 ? bridgeResult : { error: 'not ready' }, status);
    } },
    Date, JSON, Math, Number, Object, Array
  };
  runInNewContext(readFileSync(new URL('identity/Code.gs', root), 'utf8'), identity);
  return {
    data, identity, dataProperties, identityProperties, sheetReads, calendarReads,
    informationRows, chatRows,
    setSubject: value => { subject = value; },
    forwarded: () => forwarded, redirectFetches: () => redirectFetches,
    requiredScopeChecks: () => requiredScopeChecks
  };
}

function result(value) { return JSON.parse(JSON.stringify(value)); }

function signed(overrides = {}) {
  const body = JSON.stringify({
    v: 1, associationId: association, action: 'own_fee', subject: 'google-member',
    ts: Date.now(), nonce: randomUUID(), ...overrides
  });
  return { body, mac: createHmac('sha256', key).update(body).digest('base64url') };
}

function post(data, envelope) {
  return JSON.parse(data.doPost({ postData: { contents: JSON.stringify(envelope) } }).value);
}

test('dataskriptet begär filbegränsad behörighet, inte alla kalkylark', () => {
  assert.deepEqual(manifest.oauthScopes, [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/calendar.events.readonly',
    'https://www.googleapis.com/auth/script.external_request'
  ]);
});

test('medlem får bara medlemskalendern medan styrelsen får båda', () => {
  const app = fixture();
  const member = result(app.identity.readDashboardData('calendar'));
  assert.equal(member.allowed, true);
  assert.deepEqual(member.data.events.map(event => event.kind), ['member']);
  assert.equal(JSON.stringify(member).includes('private@example.invalid'), false);
  assert.equal(JSON.stringify(member).includes('Får inte lämna servern'), false);
  assert.equal(JSON.stringify(member).includes('Privat testmöte'), false);
  assert.equal(app.calendarReads.length, 1);
  assert.match(app.calendarReads[0], /member-test/);
  app.setSubject('google-board');
  const board = result(app.identity.readDashboardData('calendar'));
  assert.equal(board.allowed, true);
  assert.deepEqual(board.data.events.map(event => event.kind), ['member', 'board']);
  assert.equal(app.calendarReads.length, 3);
  assert.match(app.calendarReads[2], /board-test/);
  app.dataProperties.set('VF_MEMBER_CALENDAR_ID', null);
  assert.equal(app.identity.readDashboardData('calendar').reason, 'calendar_setup_missing');
});

test('kalender nekar okänd användare och visar inget vid API-fel', () => {
  const app = fixture();
  app.setSubject('unknown');
  assert.equal(app.identity.readDashboardData('calendar').reason, 'unknown_user');
  assert.equal(app.calendarReads.length, 0);
  const failed = fixture({ failCalendar: true });
  assert.equal(failed.identity.readDashboardData('calendar').reason, 'data_unavailable');
});

test('medlem ser bara sin egen påhittade avgift', () => {
  const app = fixture();
  assert.deepEqual(result(app.identity.readTestData_({ action: 'own_fee' })), {
    allowed: true,
    data: { memberId: 'M-001', name: 'Testmedlem', fee: 300, paid: 100, remaining: 200 }
  });
  assert.equal(app.sheetReads.length, 1);
  assert.match(app.sheetReads[0], /Medlemmar/);
});

test('instrumentpanelen lämnar bara ut profil och avgiftsstatus för medlemmen', () => {
  const app = fixture();
  assert.deepEqual(result(app.identity.readDashboardData('profile')), {
    allowed: true,
    data: { associationId: association, associationName: 'Vägfölk test',
      name: 'Testmedlem', roles: ['Medlem'], permissions: ['own_fee'] }
  });
  assert.deepEqual(result(app.identity.readDashboardData('own_fee')), {
    allowed: true,
    data: { testData: true, memberId: 'M-001', name: 'Testmedlem', remaining: 200,
      dueDate: null, status: 'unpaid', paymentNotice: null }
  });
  assert.equal(app.identity.readDashboardData('board_summary').reason, 'insufficient_role');
  assert.equal(app.identity.readDashboardData('all_members').reason, 'invalid_action');
});

test('styrelsens panel visar bara sammanfattning och nekar okänd användare', () => {
  const app = fixture();
  app.setSubject('google-board');
  assert.deepEqual(result(app.identity.readDashboardData('board_summary')), {
    allowed: true,
    data: { testData: true, period: '2026-01-01 – 2026-12-31', bank: 1250,
      cash: 80, result: 450 }
  });
  app.setSubject('google-unknown');
  assert.equal(app.identity.readDashboardData('profile').reason, 'unknown_user');
});

test('rollstyrda vyer omprövas mot aktuell EKO-roll', () => {
  const app = fixture();
  app.setSubject('google-board');
  assert.equal(app.identity.authorizeDashboardView('board').allowed, true);
  assert.equal(app.identity.authorizeDashboardView('treasurer').reason, 'insufficient_role');
  app.setSubject('google-member');
  assert.equal(app.identity.authorizeDashboardView('board').reason, 'insufficient_role');
  assert.equal(app.identity.authorizeDashboardView('secretary').reason, 'insufficient_role');
  assert.equal(app.identity.authorizeDashboardView('admin').reason, 'insufficient_role');
  assert.equal(app.identity.authorizeDashboardView('unknown').reason, 'invalid_view');
  app.setSubject('google-unknown');
  assert.equal(app.identity.authorizeDashboardView('board').reason, 'unknown_user');
});

test('profilen hämtas från aktiv EKO-rad och lämnar bara ut ID, namn och roller', () => {
  const app = fixture();
  assert.deepEqual(result(post(app.data, signed({ action: 'profile' }))), {
    allowed: true,
    data: { associationId: association, memberId: 'M-001', name: 'Testmedlem', roles: ['Medlem'] }
  });
  assert.equal(app.sheetReads.length, 1);
  app.setSubject('google-board');
  assert.deepEqual(result(post(app.data, signed({ action: 'profile', subject: 'google-board' }))), {
    allowed: true,
    data: { associationId: association, memberId: 'M-002', name: 'Teststyrelse', roles: ['Styrelse'] }
  });
});

test('profil ger ingen tillgång när status eller koppling i EKO saknas', () => {
  const app = fixture({ members: [memberHead,
    memberRow({ sub: 'google-member', status: 'Spärrad', name: 'A', id: 'M-001' })] });
  assert.equal(post(app.data, signed({ action: 'profile' })).reason, 'inactive_user');
  assert.equal(post(app.data, signed({ action: 'profile', subject: 'unknown' })).reason, 'unknown_user');
});

test('styrelse ser bara en begränsad ekonomisk översikt', () => {
  const app = fixture();
  app.setSubject('google-board');
  assert.deepEqual(result(app.identity.readTestData_({ action: 'board_summary' })), {
    allowed: true, data: { period: '2026-01-01 – 2026-12-31', bank: 1250, cash: 80, result: 450 }
  });
  assert.equal(app.sheetReads.length, 2);
});

test('medlem kan inte läsa styrelsens ekonomi och okänd användare nekas', () => {
  const app = fixture();
  assert.equal(app.identity.readTestData_({ action: 'board_summary' }).reason, 'insufficient_role');
  assert.equal(app.sheetReads.length, 1, 'Ekonomi ska inte ens hämtas');
  app.setSubject('google-unknown');
  assert.equal(app.identity.readTestData_({ action: 'own_fee' }).reason, 'unknown_user');
});

test('spärrad eller dubbelt registrerad användare nekas', () => {
  const blocked = fixture({ members: [memberHead,
    memberRow({ sub: 'google-member', status: 'Spärrad', name: 'Testmedlem', id: 'M-001' })] });
  assert.equal(blocked.identity.readTestData_({ action: 'own_fee' }).reason, 'inactive_user');
  const duplicate = fixture({ members: [memberHead,
    memberRow({ sub: 'google-member', name: 'A', id: 'M-001' }),
    memberRow({ sub: 'google-member', name: 'B', id: 'M-002' })] });
  assert.equal(duplicate.identity.readTestData_({ action: 'own_fee' }).reason, 'duplicate_identity');
});

test('fel förening, ogiltig signatur och återspelat anrop nekas före filläsning', () => {
  const app = fixture();
  assert.equal(post(app.data, signed({ associationId: 'OTHER-ASSOCIATION' })).allowed, false);
  const altered = signed();
  altered.body = altered.body.replace('own_fee', 'board_summary');
  assert.equal(post(app.data, altered).reason, 'invalid_signature');
  const valid = signed();
  assert.equal(post(app.data, valid).allowed, true);
  assert.equal(post(app.data, valid).reason, 'replayed_request');
  assert.equal(app.sheetReads.length, 1);
});

test('trasig testfil och fel i Sheets nekar åtkomst utan datautlämning', () => {
  const wrongHeaders = fixture({ members: [['Namn', 'Google-sub'], ['A', 'google-member']] });
  assert.equal(wrongHeaders.identity.readTestData_({ action: 'own_fee' }).reason, 'test_sheet_invalid');
  const failed = fixture({ failSheet: true });
  assert.equal(failed.identity.readTestData_({ action: 'own_fee' }).reason, 'data_unavailable');
});

test('ogiltig handling skickas inte till dataskriptet', () => {
  const app = fixture();
  assert.equal(app.identity.readTestData_({ action: 'all_members' }).reason, 'invalid_action');
  assert.equal(app.forwarded(), 0);
});

test('saknad extern behörighet för besökaren förklaras före anropet', () => {
  const app = fixture({ authorizationMissing: true });
  assert.deepEqual(result(app.identity.readTestData_({ action: 'own_fee' })), {
    allowed: false, reason: 'authorization_required'
  });
  assert.equal(app.forwarded(), 0);
});

test('webbappen visar inte instrumentpanelen om Google-behörighet saknas', () => {
  const app = fixture({ authorizationMissing: true });
  const page = app.identity.doGet({ parameter: { view: 'dashboard' } });
  assert.match(page.html, /Ingen åtkomst/);
  assert.doesNotMatch(page.html, /TESTPERSON|Styrelseöversikt/);
  assert.equal(app.requiredScopeChecks(), 1);
  assert.equal(app.forwarded(), 0);
});

test('okänt konto stoppas innan instrumentpanelen hämtas', () => {
  const app = fixture();
  app.setSubject('google-unknown');
  const page = app.identity.doGet({ parameter: { view: 'dashboard' } });
  assert.match(page.html, /Kontot har inte tillgång till föreningen/);
  assert.equal(app.forwarded(), 1);
});

test('ett fel i bryggans HTTP-svar lämnar aldrig ut testdata', () => {
  const app = fixture({ bridgeStatus: 403 });
  assert.deepEqual(result(app.identity.readTestData_({ action: 'own_fee' })), {
    allowed: false, reason: 'data_unavailable'
  });
  assert.equal(app.forwarded(), 1);
  assert.equal(app.sheetReads.length, 0);
});

test('ett tillfälligt 404 hämtar samma engångssvar utan ny POST', () => {
  const app = fixture({ redirectCodes: [404, 200] });
  app.setSubject('google-unknown');
  assert.equal(app.identity.readTestData_({ action: 'own_fee' }).reason, 'unknown_user');
  assert.equal(app.forwarded(), 1);
  assert.equal(app.redirectFetches(), 2);
  assert.equal(app.sheetReads.length, 1);
});

test('bestående 404 och oväntad omdirigering nekar åtkomst', () => {
  const unavailable = fixture({ redirectCodes: [404, 404, 404] });
  assert.equal(unavailable.identity.readTestData_({ action: 'own_fee' }).reason,
    'data_unavailable');
  assert.equal(unavailable.forwarded(), 1);
  assert.equal(unavailable.redirectFetches(), 3);
  const wrongHost = fixture({ redirectCodes: [200],
    redirectLocation: 'https://example.com/macros/echo?user_content_key=TEST' });
  assert.equal(wrongHost.identity.readTestData_({ action: 'own_fee' }).reason,
    'data_unavailable');
  assert.equal(wrongHost.redirectFetches(), 0);
});

test('Information och Chat hålls åtskilda och endast styrelsen får publicera Information', () => {
  const app = fixture();
  assert.equal(app.identity.publishInformation('Viktigt besked').reason, 'insufficient_role');
  assert.equal(app.informationRows.length, 1);
  assert.equal(app.identity.postChatMessage('Blir sen').allowed, true);
  assert.equal(app.chatRows.length, 2);
  assert.equal(app.chatRows[1][1], 'M-001');
  assert.equal(result(app.identity.readDashboardData('chat')).data.messages[0].text, 'Blir sen');
  assert.equal(result(app.identity.readDashboardData('information')).data.message, null);
  app.setSubject('google-board');
  assert.equal(app.identity.publishInformation('Viktigt besked').allowed, true);
  assert.equal(result(app.identity.readDashboardData('information')).data.message.text, 'Viktigt besked');
  assert.equal(result(app.identity.readDashboardData('chat')).data.messages.length, 1);
});

test('okänt konto och ogiltigt innehåll får inte skriva meddelanden', () => {
  const app = fixture();
  app.setSubject('google-unknown');
  assert.equal(app.identity.postChatMessage('Hej').reason, 'unknown_user');
  assert.equal(app.identity.publishInformation('Test').reason, 'unknown_user');
  app.setSubject('google-board');
  assert.equal(app.identity.postChatMessage('x'.repeat(121)).reason, 'invalid_content');
  assert.equal(app.identity.publishInformation(' ').reason, 'invalid_content');
  assert.equal(app.informationRows.length, 1);
  assert.equal(app.chatRows.length, 1);
});
