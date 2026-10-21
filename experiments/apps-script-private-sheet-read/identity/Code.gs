// ENDAST TESTDATA. Webbappen kör som besökaren och har ingen Sheets-åtkomst.
const ASSOCIATION_PROPERTY = 'VF_TEST_ASSOCIATION_ID';
const KEY_PROPERTY = 'VF_TEST_BRIDGE_KEY';
const DATA_URL_PROPERTY = 'VF_TEST_DATA_URL';
const DASHBOARD_URL = 'https://raw.githubusercontent.com/vagfolk/vf-app/40b2360ac4be6c5b14094d25cee396955caaafb9/public/dashboard-google.html';
const DASHBOARD_SHA256 = '23br_EXjHIdjV-c-4RaCxutFiLhBg1ynhp7n58Y7FnA';

function doGet(request) {
  ScriptApp.requireAllScopes(ScriptApp.AuthMode.FULL);
  const appUrl = ScriptApp.getService().getUrl();
  const view = request && request.parameter && request.parameter.view;
  if (view === 'login' || view === 'logout') {
    const left = view === 'logout' ? readTestData_({ action: 'leave_app' }) : null;
    const heading = view === 'logout' ? 'Appen är stängd' : 'Välkommen till Vägfölk';
    const message = view === 'logout'
      ? (left && left.allowed ? 'Din appnärvaro har avslutats. Google-kontot är fortfarande inloggat i webbläsaren.'
        : 'Appvyn är stängd, men avslutad appnärvaro kunde inte bekräftas. Google-kontot är fortfarande inloggat i webbläsaren.')
      : 'Logga in med det Google-konto som är kopplat till ditt medlemskap.';
    const chooseAccountUrl = 'https://accounts.google.com/AccountChooser?continue=' +
      encodeURIComponent(appUrl + '?view=dashboard');
    return HtmlService.createHtmlOutput('<!doctype html><html lang="sv"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Vägfölk 26 – ' + (view === 'logout' ? 'utloggad' : 'logga in') + '</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#090b10;color:#f3efe6;font:18px system-ui,sans-serif}main{max-width:32rem;padding:2rem}h1{font-size:1.5rem;color:#d2a637}.app-status{color:#ff6973;font-weight:700}a{display:inline-block;margin-top:1rem;padding:.8rem 1.2rem;border:1px solid #d2a637;border-radius:.6rem;background:#34280d;color:#fff;text-decoration:none}a:hover,a:focus-visible{background:#57421a;outline:2px solid #d2a637;outline-offset:3px}</style></head><body><main><p class="app-status">Status – Online</p><h1>' + heading + '</h1><p>' + message + '</p><a target="_top" href="' + chooseAccountUrl + '">Välj Google-konto</a></main></body></html>')
      .setTitle('Vägfölk 26 – ' + (view === 'logout' ? 'utloggad' : 'logga in'));
  }
  const access = readDashboardData('profile');
  if (!access.allowed) {
    const message = access.reason === 'unknown_user' || access.reason === 'inactive_user'
      ? 'Kontot har inte tillgång till föreningen.'
      : 'Åtkomsten kunde inte kontrolleras. Försök igen senare.';
    return HtmlService.createHtmlOutput('<!doctype html><html lang="sv"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Vägfölk 26 – ingen åtkomst</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#090b10;color:#f3efe6;font:18px system-ui,sans-serif}main{max-width:32rem;padding:2rem}h1{font-size:1.5rem;color:#d2a637}.app-status{color:#ff6973;font-weight:700}a{display:inline-block;margin-top:1rem;padding:.8rem 1.2rem;border:1px solid #d2a637;border-radius:.6rem;background:#34280d;color:#fff;text-decoration:none}a:hover,a:focus-visible{background:#57421a;outline:2px solid #d2a637;outline-offset:3px}</style></head><body><main><p class="app-status">Status – Online</p><h1>Ingen åtkomst</h1><p>' + message + '</p><a target="_top" href="' + appUrl + '?view=login">Tillbaka till inloggningen</a></main></body></html>')
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
  return HtmlService.createHtmlOutput(html.replace('__VF_LOGOUT_URL__', appUrl + '?view=logout'))
    .setTitle('Vägfölk 26');
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
  if (!['profile', 'own_fee', 'board_summary', 'treasurer_eko', 'calendar', 'calendar_version', 'app_versions', 'information', 'chat',
      'publish_information', 'delete_information', 'post_chat', 'tasks', 'contacts',
      'create_task', 'complete_task', 'recall_task', 'archive_task', 'save_contact',
      'delete_contact', 'documents', 'document_open', 'document_upload', 'document_delete',
      'leave_app'].includes(action)) {
    return { allowed: false, reason: 'invalid_action' };
  }
  const contentAction = ['publish_information', 'delete_information', 'post_chat', 'create_task',
    'complete_task', 'recall_task', 'archive_task', 'save_contact', 'delete_contact',
    'document_open', 'document_upload', 'document_delete'].includes(action);
  const content = request && request.content;
  if (contentAction && (typeof content !== 'string' ||
      !content.trim() || content.length > (action === 'document_upload' ? 7100000 :
        action === 'save_contact' ? 170000 :
        action === 'post_chat' ? 120 : 600))) {
    return { allowed: false, reason: 'invalid_content' };
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
  const body = {
    v: 1, associationId: associationId, action: action, subject: subject,
    ts: Date.now(), nonce: Utilities.getUuid()
  };
  if (contentAction) body.content = content;
  const bodyText = JSON.stringify(body);
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
  if (!['profile', 'own_fee', 'board_summary', 'treasurer_eko', 'calendar', 'calendar_version', 'app_versions', 'information', 'chat',
      'tasks', 'contacts', 'documents'].includes(action)) {
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
      name: data.name, roles: roles, permissions: permissions,
      online: Number.isSafeInteger(data.online) && data.online >= 1 && data.online <= 1000
        ? data.online : 1
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
  if (action === 'treasurer_eko') {
    if (!Array.isArray(data.sheets) || data.sheets.length < 1 || data.sheets.length > 12) {
      return { allowed: false, reason: 'data_unavailable' };
    }
    let cells = 0;
    for (const sheet of data.sheets) {
      if (!sheet || typeof sheet.name !== 'string' || !sheet.name || sheet.name.length > 100 ||
          typeof sheet.hidden !== 'boolean' || !Array.isArray(sheet.rows) ||
          sheet.rows.length > 10000) return { allowed: false, reason: 'data_unavailable' };
      for (const row of sheet.rows) {
        if (!Array.isArray(row) || row.length > 100 || row.some(cell =>
            typeof cell !== 'string' || cell.length > 10000)) {
          return { allowed: false, reason: 'data_unavailable' };
        }
        cells += row.length;
        if (cells > 150000) return { allowed: false, reason: 'data_unavailable' };
      }
    }
    return { allowed: true, data: { sheets: data.sheets } };
  }
  if (action === 'app_versions') {
    const validTime = function(value) {
      return typeof value === 'string' && Number.isFinite(Date.parse(value));
    };
    const calendar = data.calendar;
    if (!validTime(data.eko) || !validTime(data.store) || !validTime(data.contacts) ||
        typeof data.documents !== 'string' || data.documents.length > 100 ||
        !Number.isSafeInteger(data.online) || data.online < 1 || data.online > 1000 || !calendar ||
        typeof calendar !== 'object' || Array.isArray(calendar) ||
        Object.keys(calendar).some(function(kind) { return !['member', 'board'].includes(kind); }) ||
        !validTime(calendar.member) ||
        (calendar.board !== undefined && !validTime(calendar.board))) {
      return { allowed: false, reason: 'data_unavailable' };
    }
    return { allowed: true, data: { eko: data.eko, store: data.store,
      contacts: data.contacts, documents: data.documents, online: data.online,
      calendar: calendar } };
  }
  if (action === 'calendar' || action === 'calendar_version') {
    const version = data.version;
    if (!version || typeof version !== 'object' || Array.isArray(version) ||
        Object.keys(version).some(function(kind) { return !['member', 'board'].includes(kind); }) ||
        typeof version.member !== 'string' || !Number.isFinite(Date.parse(version.member)) ||
        (version.board !== undefined &&
          (typeof version.board !== 'string' || !Number.isFinite(Date.parse(version.board))))) {
      return { allowed: false, reason: 'data_unavailable' };
    }
    if (action === 'calendar_version') {
      return { allowed: true, data: { version: version } };
    }
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
    return { allowed: true, data: { testData: true, events: data.events,
      links: links, version: version } };
  }
  if (action === 'information') {
    const message = data.message;
    if (message !== null && (!message || typeof message !== 'object' ||
        typeof message.id !== 'string' || typeof message.name !== 'string' ||
        typeof message.text !== 'string' || typeof message.createdAt !== 'string')) {
      return { allowed: false, reason: 'data_unavailable' };
    }
    if (data.messages !== undefined &&
        (!Array.isArray(data.messages) || data.messages.length > 1000 ||
          data.messages.some(function(item) {
            return !item || typeof item.id !== 'string' ||
              typeof item.name !== 'string' || typeof item.text !== 'string' ||
              typeof item.createdAt !== 'string';
          }))) return { allowed: false, reason: 'data_unavailable' };
    return { allowed: true, data: { message: message,
      ...(data.messages === undefined ? {} : { messages: data.messages }) } };
  }
  if (action === 'chat') {
    if (!Array.isArray(data.messages) || data.messages.length > 50 ||
        data.messages.some(function(message) {
          return !message || typeof message.id !== 'string' ||
            typeof message.name !== 'string' || typeof message.text !== 'string' ||
            typeof message.createdAt !== 'string';
        })) return { allowed: false, reason: 'data_unavailable' };
    return { allowed: true, data: { messages: data.messages } };
  }
  if (action === 'tasks') {
    if (!Array.isArray(data.tasks) || data.tasks.length > 1000 ||
        data.tasks.some(function(task) {
          return !task || typeof task.id !== 'string' ||
            !/^[0-9a-f-]{36}$/i.test(task.id) ||
            !['medlem', 'styrelse', 'prioriterad'].includes(task.kind) ||
            typeof task.text !== 'string' || task.text.length > 100 ||
            typeof task.done !== 'boolean' || typeof task.canRecall !== 'boolean' ||
            (task.completedBy !== null && typeof task.completedBy !== 'string') ||
            (task.completedAt !== null && typeof task.completedAt !== 'string');
        })) return { allowed: false, reason: 'data_unavailable' };
    return { allowed: true, data: { tasks: data.tasks } };
  }
  if (action === 'contacts') {
    if (!Array.isArray(data.contacts) || data.contacts.length > 1000 ||
        data.contacts.some(function(contact) {
          return !contact || typeof contact.cardId !== 'string' ||
            (contact.cardId && !/^[0-9a-f-]{36}$/i.test(contact.cardId)) ||
            typeof contact.memberId !== 'string' ||
            typeof contact.name !== 'string' || typeof contact.phone !== 'string' ||
            typeof contact.email !== 'string' || contact.name.length > 80 ||
            contact.phone.length > 40 || contact.email.length > 120 ||
            typeof contact.description !== 'string' || contact.description.length > 400 ||
            typeof contact.avatar !== 'string' || contact.avatar.length > 18000 ||
            (contact.avatar && !/^[A-Za-z0-9+/]+={0,2}$/.test(contact.avatar));
        })) return { allowed: false, reason: 'data_unavailable' };
    return { allowed: true, data: { contacts: data.contacts } };
  }
  if (action === 'documents') {
    if (!Array.isArray(data.documents) || data.documents.length > 1000 ||
        data.documents.some(function(item) {
          return !item || typeof item.id !== 'string' ||
            !/^[A-Za-z0-9_-]{20,128}$/.test(item.id) ||
            typeof item.name !== 'string' || item.name.length > 160 ||
            !['member', 'board'].includes(item.kind) ||
            typeof item.mimeType !== 'string' || item.mimeType.length > 120 ||
            typeof item.size !== 'number' || !Number.isFinite(item.size) ||
            item.size < 0 || item.size > 5000000 ||
            typeof item.modifiedTime !== 'string';
        })) return { allowed: false, reason: 'data_unavailable' };
    return { allowed: true, data: { documents: data.documents } };
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

function publishInformation(text) {
  const result = readTestData_({ action: 'publish_information', content: text });
  return result.allowed && result.data && result.data.saved === true
    ? { allowed: true } : { allowed: false, reason: result.reason || 'data_unavailable' };
}

function deleteInformation(id) {
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) {
    return { allowed: false, reason: 'invalid_content' };
  }
  const result = readTestData_({ action: 'delete_information', content: id });
  return result.allowed && result.data && result.data.saved === true
    ? { allowed: true } : { allowed: false, reason: result.reason || 'data_unavailable' };
}

function postChatMessage(text) {
  const result = readTestData_({ action: 'post_chat', content: text });
  return result.allowed && result.data && result.data.saved === true
    ? { allowed: true } : { allowed: false, reason: result.reason || 'data_unavailable' };
}

function createTask(input) {
  if (!input || typeof input !== 'object' ||
      !['medlem', 'styrelse', 'prioriterad'].includes(input.kind) ||
      typeof input.text !== 'string' || !input.text.trim() ||
      input.text.length > 100) return { allowed: false, reason: 'invalid_content' };
  return taskWrite_('create_task', JSON.stringify({ kind: input.kind, text: input.text }));
}

function completeTask(id) { return taskWrite_('complete_task', id); }
function recallTask(id) { return taskWrite_('recall_task', id); }
function archiveTask(id) { return taskWrite_('archive_task', id); }

function saveContact(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { allowed: false, reason: 'invalid_content' };
  }
  const result = readTestData_({ action: 'save_contact', content: JSON.stringify(input) });
  return result.allowed && result.data?.saved === true
    ? { allowed: true, cardId: result.data.cardId }
    : { allowed: false, reason: result.reason || 'data_unavailable' };
}

function deleteContact(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { allowed: false, reason: 'invalid_content' };
  }
  const result = readTestData_({ action: 'delete_contact', content: JSON.stringify(input) });
  return result.allowed && result.data?.saved === true
    ? { allowed: true } : { allowed: false, reason: result.reason || 'data_unavailable' };
}

function uploadDocument(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      typeof input.name !== 'string' || typeof input.content !== 'string' ||
      !['member', 'board'].includes(input.kind)) {
    return { allowed: false, reason: 'invalid_content' };
  }
  const result = readTestData_({ action: 'document_upload', content: JSON.stringify(input) });
  return result.allowed && result.data?.saved === true
    ? { allowed: true, id: result.data.id }
    : { allowed: false, reason: result.reason || 'data_unavailable' };
}

function deleteDocument(id) {
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{20,128}$/.test(id)) {
    return { allowed: false, reason: 'invalid_content' };
  }
  const result = readTestData_({ action: 'document_delete', content: id });
  return result.allowed && result.data?.saved === true
    ? { allowed: true } : { allowed: false, reason: result.reason || 'data_unavailable' };
}

function openDocument(id) {
  const result = readTestData_({ action: 'document_open', content: id });
  if (!result.allowed) return result;
  const data = result.data;
  if (!data || typeof data.name !== 'string' || data.name.length > 160 ||
      typeof data.mimeType !== 'string' || data.mimeType.length > 120 ||
      typeof data.content !== 'string' || data.content.length > 6700000 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(data.content)) {
    return { allowed: false, reason: 'data_unavailable' };
  }
  return { allowed: true, data: data };
}

function leaveApp() {
  return readTestData_({ action: 'leave_app' });
}

function taskWrite_(action, content) {
  const result = readTestData_({ action: action, content: content });
  return result.allowed && result.data && result.data.saved === true
    ? { allowed: true, taskId: result.data.taskId }
    : { allowed: false, reason: result.reason || 'data_unavailable' };
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

// ContentService svarar med en engångs-URL. Google kan ge ytterligare en 302
// eller ett kortvarigt 404. Endast Googles engångs-URL får följas; den signerade
// POST-begäran körs aldrig en gång till.
function readBridgeResponse_(initial) {
  let response = initial;
  let location = null;
  let missing = 0;
  for (let attempt = 0; attempt < 7; attempt++) {
    const status = response.getResponseCode();
    if (status === 200) return response;
    if (status === 302) {
      const headers = response.getAllHeaders();
      location = headers && (headers.Location || headers.location);
      if (typeof location !== 'string' ||
          !location.startsWith('https://script.googleusercontent.com/macros/echo?')) {
        throw new Error('Unexpected bridge redirect');
      }
      missing = 0;
    } else if (status === 404 && location && missing < 2) {
      missing++;
      Utilities.sleep(missing === 1 ? 1000 : 3000);
    } else {
      return response;
    }
    response = UrlFetchApp.fetch(location, {
      method: 'get', followRedirects: false, muteHttpExceptions: true
    });
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
