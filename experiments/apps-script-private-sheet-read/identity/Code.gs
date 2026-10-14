// ENDAST TESTDATA. Webbappen kör som besökaren och har ingen Sheets-åtkomst.
const ASSOCIATION_PROPERTY = 'VF_TEST_ASSOCIATION_ID';
const KEY_PROPERTY = 'VF_TEST_BRIDGE_KEY';
const DATA_URL_PROPERTY = 'VF_TEST_DATA_URL';
const DASHBOARD_URL = 'https://raw.githubusercontent.com/vagfolk/vf-app/204710f/public/dashboard-google.html';
const DASHBOARD_SHA256 = 'XYDWfXis-ihnHLK8dboQL-iPfKvdf4tngb0WcVtnW9Q';

function doGet(request) {
  ScriptApp.requireAllScopes(ScriptApp.AuthMode.FULL);
  const appUrl = ScriptApp.getService().getUrl();
  if (request && request.parameter && request.parameter.view === 'login') {
    const chooseAccountUrl = 'https://accounts.google.com/AccountChooser?continue=' +
      encodeURIComponent(appUrl + '?view=dashboard');
    return HtmlService.createHtmlOutput('<!doctype html><html lang="sv"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Vägfölk 26 – logga in</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#090b10;color:#f3efe6;font:18px system-ui,sans-serif}main{max-width:32rem;padding:2rem}h1{font-size:1.5rem;color:#d2a637}a{display:inline-block;margin-top:1rem;padding:.8rem 1.2rem;border:1px solid #d2a637;border-radius:.6rem;background:#34280d;color:#fff;text-decoration:none}a:hover,a:focus-visible{background:#57421a;outline:2px solid #d2a637;outline-offset:3px}</style></head><body><main><h1>Välkommen till Vägfölk</h1><p>Logga in med det Google-konto som är kopplat till ditt medlemskap.</p><a target="_top" href="' + chooseAccountUrl + '">Välj Google-konto</a></main></body></html>')
      .setTitle('Vägfölk 26 – logga in');
  }
  const access = readDashboardData('profile');
  if (!access.allowed) {
    const message = access.reason === 'unknown_user' || access.reason === 'inactive_user'
      ? 'Kontot har inte tillgång till föreningen.'
      : 'Åtkomsten kunde inte kontrolleras. Försök igen senare.';
    return HtmlService.createHtmlOutput('<!doctype html><html lang="sv"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Vägfölk 26 – ingen åtkomst</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#090b10;color:#f3efe6;font:18px system-ui,sans-serif}main{max-width:32rem;padding:2rem}h1{font-size:1.5rem;color:#d2a637}a{display:inline-block;margin-top:1rem;padding:.8rem 1.2rem;border:1px solid #d2a637;border-radius:.6rem;background:#34280d;color:#fff;text-decoration:none}a:hover,a:focus-visible{background:#57421a;outline:2px solid #d2a637;outline-offset:3px}</style></head><body><main><h1>Ingen åtkomst</h1><p>' + message + '</p><a target="_top" href="' + appUrl + '?view=login">Tillbaka till inloggningen</a></main></body></html>')
      .setTitle('Vägfölk 26 – ingen åtkomst');
  }
  const dashboard = request && request.parameter && request.parameter.view === 'dashboard';
  if (!dashboard) return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('VF privat läsprov – endast låtsasdata');
  const response = UrlFetchApp.fetch(DASHBOARD_URL, {
    muteHttpExceptions: true, followRedirects: true
  });
  if (response.getResponseCode() !== 200) throw new Error('Instrumentpanelen kunde inte hämtas');
  const html = response.getContentText('UTF-8');
  const digest = Utilities.base64EncodeWebSafe(Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256, response.getContent())).replace(/=+$/, '');
  if (digest !== DASHBOARD_SHA256) throw new Error('Instrumentpanelens version avviker');
  return HtmlService.createHtmlOutput(html).setTitle('Vägfölk 26 – endast låtsasdata');
}

// Visas bara för att testaren ska kunna kontrollera vilket konto som används.
// E-postadressen används aldrig som behörighetsnyckel; det gör Googles sub-ID.
function getTestAccount() {
  const token = ScriptApp.getIdentityToken();
  if (typeof token !== 'string') return { email: null };
  const parts = token.split('.');
  if (parts.length !== 3) return { email: null };
  try {
    const payload = JSON.parse(Utilities.newBlob(
      Utilities.base64DecodeWebSafe(parts[1])).getDataAsString('UTF-8'));
    return { email: typeof payload.email === 'string' ? payload.email : null };
  } catch (_error) {
    return { email: null };
  }
}

function readTestData_(request) {
  const action = request && typeof request === 'object' && !Array.isArray(request)
    ? request.action : null;
  if (action !== 'profile' && action !== 'own_fee' && action !== 'board_summary' &&
      action !== 'calendar') {
    return { allowed: false, reason: 'invalid_action' };
  }
  const subject = currentGoogleSubject_();
  if (!subject) return { allowed: false, reason: 'identity_missing' };
  const properties = PropertiesService.getScriptProperties();
  const associationId = properties.getProperty(ASSOCIATION_PROPERTY);
  const keyText = properties.getProperty(KEY_PROPERTY);
  const dataUrl = properties.getProperty(DATA_URL_PROPERTY);
  if (!associationId || !/^[A-Za-z0-9_-]{8,64}$/.test(associationId) ||
      !keyText || !dataUrl ||
      !/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(dataUrl)) {
    return { allowed: false, reason: 'setup_missing' };
  }
  const keyBytes = Utilities.base64DecodeWebSafe(keyText);
  if (keyBytes.length !== 32) return { allowed: false, reason: 'setup_invalid' };
  const bodyText = JSON.stringify({
    v: 1, associationId: associationId, action: action, subject: subject,
    ts: Date.now(), nonce: Utilities.getUuid()
  });
  const mac = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(
    Utilities.newBlob(bodyText, 'text/plain').getBytes(), keyBytes)).replace(/=+$/, '');
  try {
    const permission = ScriptApp.getAuthorizationInfo(ScriptApp.AuthMode.FULL,
      ['https://www.googleapis.com/auth/script.external_request']);
    if (permission.getAuthorizationStatus() === ScriptApp.AuthorizationStatus.REQUIRED) {
      return { allowed: false, reason: 'authorization_required' };
    }
    const initial = UrlFetchApp.fetch(dataUrl, {
      method: 'post', contentType: 'application/json; charset=utf-8',
      payload: JSON.stringify({ body: bodyText, mac: mac }),
      followRedirects: false, muteHttpExceptions: true
    });
    const response = readBridgeResponse_(initial);
    if (response.getResponseCode() !== 200) {
      console.warn('VF test bridge: HTTP ' + response.getResponseCode());
      return { allowed: false, reason: 'data_unavailable' };
    }
    const result = JSON.parse(response.getContentText());
    if (!result || typeof result !== 'object' || typeof result.allowed !== 'boolean') {
      console.warn('VF test bridge: invalid response');
      return { allowed: false, reason: 'data_unavailable' };
    }
    return result;
  } catch (error) {
    const message = String(error && error.message || '');
    const category = /authorization|permission to call UrlFetchApp/i.test(message)
      ? 'authorization' : /quota|limit exceeded|too many times/i.test(message)
        ? 'quota' : 'other';
    console.warn('VF test bridge: exception ' + category);
    return { allowed: false, reason: 'data_unavailable' };
  }
}

// Endast begränsade vydata lämnas till instrumentpanelen. Dataskriptet gör
// medlems- och rollkontrollen på nytt vid varje anrop.
function readDashboardData(action) {
  if (!['profile', 'own_fee', 'board_summary', 'calendar'].includes(action)) {
    return { allowed: false, reason: 'invalid_action' };
  }
  const result = readTestData_({ action: action });
  if (!result.allowed) return result;
  const data = result.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { allowed: false, reason: 'data_unavailable' };
  }
  if (action === 'profile') {
    const roles = data.roles;
    const rolePermissions = {
      Medlem: ['own_fee'],
      Styrelse: ['own_fee', 'board_view', 'sales_manage'],
      Sekreterare: ['own_fee', 'board_view', 'sales_manage', 'members_manage', 'roles_manage'],
      'Kassör': ['own_fee', 'board_view', 'sales_manage', 'finance_manage'],
      Admin: ['own_fee', 'board_view', 'sales_manage', 'members_manage', 'roles_manage', 'finance_manage', 'recovery_manage']
    };
    if (typeof data.associationId !== 'string' ||
        data.associationId !== PropertiesService.getScriptProperties().getProperty(ASSOCIATION_PROPERTY) ||
        typeof data.name !== 'string' || !data.name ||
        typeof data.memberId !== 'string' || !data.memberId ||
        !Array.isArray(roles) || roles.length < 1 || roles.length > 2 ||
        roles.some(function(role) { return !Object.prototype.hasOwnProperty.call(rolePermissions, role); })) {
      return { allowed: false, reason: 'data_unavailable' };
    }
    const permissions = [...new Set(roles.flatMap(function(role) { return rolePermissions[role]; }))].sort();
    return { allowed: true, data: {
      associationId: data.associationId, associationName: 'Vägfölk test',
      name: data.name, roles: roles, permissions: permissions
    } };
  }
  if (action === 'own_fee') {
    if (typeof data.memberId !== 'string' || !data.memberId ||
        typeof data.name !== 'string' || !data.name ||
        typeof data.fee !== 'number' || !Number.isFinite(data.fee) ||
        typeof data.paid !== 'number' || !Number.isFinite(data.paid) ||
        data.fee < 0 || data.paid < 0 || data.fee > 1000000 || data.paid > 1000000) {
      return { allowed: false, reason: 'data_unavailable' };
    }
    const remaining = Math.max(0, data.fee - data.paid);
    return { allowed: true, data: {
      testData: true, memberId: data.memberId, name: data.name,
      remaining: remaining, dueDate: null,
      status: remaining === 0 ? 'paid' : 'unpaid', paymentNotice: null
    } };
  }
  if (action === 'calendar') {
    const links = data.links === undefined ? null : data.links;
    if (!Array.isArray(data.events) || data.events.length > 2000 ||
        data.events.some(function(event) {
          return !event || !['member', 'board'].includes(event.kind) ||
            typeof event.title !== 'string' || event.title.length > 120 ||
            typeof event.start !== 'string' || typeof event.end !== 'string' ||
            typeof event.allDay !== 'boolean';
        }) || (links !== null && (typeof links !== 'object' ||
          !['member', 'board'].every(function(kind) {
            return typeof links[kind] === 'string' &&
              /^https:\/\/calendar\.google\.com\/calendar\/u\/0\/r\?cid=[^&#\s]+$/.test(links[kind]);
          })))) {
      return { allowed: false, reason: 'data_unavailable' };
    }
    return { allowed: true, data: { testData: true, events: data.events, links: links } };
  }
  if (typeof data.period !== 'string' || !data.period ||
      ['bank', 'cash', 'result'].some(function(field) {
        return typeof data[field] !== 'number' || !Number.isFinite(data[field]) ||
          Math.abs(data[field]) > 100000000;
      })) {
    return { allowed: false, reason: 'data_unavailable' };
  }
  return { allowed: true, data: {
    testData: true, period: data.period,
    bank: data.bank, cash: data.cash, result: data.result
  } };
}

// Kontrollera aktuell EKO-roll på nytt innan en rollstyrd vy öppnas.
// Detta ger inte åtkomst till data; varje framtida dataanrop måste också prövas.
function authorizeDashboardView(view) {
  const required = {
    board: 'board_view',
    secretary: 'members_manage',
    treasurer: 'finance_manage',
    admin: 'recovery_manage'
  };
  if (!Object.prototype.hasOwnProperty.call(required, view)) {
    return { allowed: false, reason: 'invalid_view' };
  }
  const profile = readDashboardData('profile');
  if (!profile.allowed) return { allowed: false, reason: profile.reason };
  const allowed = profile.data.permissions.includes(required[view]);
  return {
    allowed: allowed,
    reason: allowed ? null : 'insufficient_role',
    profile: profile.data
  };
}

// ContentService svarar med en engångs-URL. Ett 404 från den URL:en får
// hämtas om; den signerade POST-begäran körs aldrig en gång till.
function readBridgeResponse_(initial) {
  if (initial.getResponseCode() !== 302) return initial;
  const headers = initial.getAllHeaders();
  const location = headers && (headers.Location || headers.location);
  if (typeof location !== 'string' ||
      !location.startsWith('https://script.googleusercontent.com/macros/echo?')) {
    throw new Error('Unexpected bridge redirect');
  }
  let response;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) Utilities.sleep(attempt === 1 ? 1000 : 3000);
    response = UrlFetchApp.fetch(location, {
      method: 'get', followRedirects: false, muteHttpExceptions: true
    });
    if (response.getResponseCode() !== 404) return response;
  }
  return response;
}

function currentGoogleSubject_() {
  const token = ScriptApp.getIdentityToken();
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(Utilities.newBlob(
      Utilities.base64DecodeWebSafe(parts[1])).getDataAsString('UTF-8'));
    return typeof payload.sub === 'string' && payload.sub ? payload.sub : null;
  } catch (_error) {
    return null;
  }
}
