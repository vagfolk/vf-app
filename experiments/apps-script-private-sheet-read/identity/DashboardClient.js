// Endast låtsasdata. Den här filen bäddas in i Dashboard.html vid provbygget.
(() => {
  const state = { user: null, fee: null, boardSummary: null, calendar: null, connection: 'checking' };
  let boardRequest = 0;
  let calendarRequest = 0;
  let activeView = 'start';

  function show() { window.VFDashboard?.setData(state); }
  function notice(message) {
    const node = document.querySelector('.app-notice');
    if (node) node.textContent = message;
  }
  function call(name, value) {
    return new Promise((resolve, reject) => {
      if (!window.google?.script?.run) return reject(new Error('Google-anslutning saknas'));
      const runner = google.script.run
        .withSuccessHandler(resolve)
        .withFailureHandler(reject);
      if (value === undefined) runner[name]();
      else runner[name](value);
    });
  }
  async function read(action) {
    const result = await call('readDashboardData', action);
    if (!result || typeof result.allowed !== 'boolean' ||
        (result.allowed && (!result.data || typeof result.data !== 'object'))) {
      throw new Error('Ogiltigt svar');
    }
    if (!result.allowed) {
      const error = new Error('Åtkomst nekad');
      error.reason = result.reason;
      throw error;
    }
    return result.data;
  }
  async function start() {
    try {
      const account = await call('getTestAccount');
      if (!account || typeof account.email !== 'string' || !account.email) {
        throw new Error('Google-konto kunde inte fastställas');
      }
      const profile = await read('profile');
      const fee = await read('own_fee');
      if (!Array.isArray(profile.permissions) || !profile.permissions.includes('own_fee') ||
          typeof fee.memberId !== 'string' || !fee.memberId) {
        throw new Error('Ogiltig medlemsprofil');
      }
      state.user = profile;
      state.fee = fee;
      state.connection = 'google_test';
      show();
      notice('Inloggat Google-konto: ' + account.email +
        '. Testversion. Kalenderhändelser läses från föreningens två testkalendrar.');
      loadCalendar();
    } catch (error) {
      state.user = null;
      state.fee = null;
      state.boardSummary = null;
      state.calendar = null;
      state.connection = 'error';
      show();
      notice(error && error.reason === 'unknown_user' || error && error.reason === 'inactive_user'
        ? 'Kontot har inte tillgång till föreningen.'
        : 'Den skyddade testvyn kunde inte öppnas. Inga EKO-uppgifter visas.');
    }
  }
  async function loadCalendar() {
    const request = ++calendarRequest;
    state.calendar = null;
    window.VFDashboard?.refresh();
    try {
      const profile = await read('profile');
      if (request !== calendarRequest) return;
      state.user = profile;
      if (!profile.permissions?.includes('board_view')) state.boardSummary = null;
      show();
      const calendar = await read('calendar');
      if (request !== calendarRequest) return;
      state.calendar = calendar;
    } catch (error) {
      if (request !== calendarRequest) return;
      if (error?.reason === 'unknown_user' || error?.reason === 'inactive_user') {
        state.user = null;
        state.fee = null;
        state.boardSummary = null;
      }
      state.calendar = { error: true, events: [] };
    }
    show();
  }
  async function loadBoard() {
    const request = ++boardRequest;
    state.boardSummary = null;
    window.VFDashboard?.refresh();
    try {
      const profile = await read('profile');
      if (request !== boardRequest) return;
      state.user = profile;
      if (!profile.permissions?.includes('board_view')) {
        show();
        document.dispatchEvent(new CustomEvent('vf:navigate', { detail: { id: 'start' } }));
        return;
      }
      show();
      const summary = await read('board_summary');
      if (request !== boardRequest) return;
      state.boardSummary = summary;
    } catch {
      if (request !== boardRequest) return;
      state.user = null;
      state.fee = null;
      state.boardSummary = null;
      show();
      notice('Åtkomsten kunde inte kontrolleras på nytt. Inga styrelseuppgifter visas.');
      document.dispatchEvent(new CustomEvent('vf:navigate', { detail: { id: 'start' } }));
      return;
    }
    window.VFDashboard?.refresh();
  }

  document.addEventListener('vf:view-selected', event => {
    activeView = event.detail?.id || 'start';
    if (activeView === 'board') loadBoard();
    if (activeView === 'kalender' || activeView === 'start') loadCalendar();
    else {
      ++boardRequest;
      state.boardSummary = null;
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && activeView === 'board') loadBoard();
    if (!document.hidden && (activeView === 'kalender' || activeView === 'start')) loadCalendar();
  });
  document.addEventListener('vf:signout', () => {
    ++boardRequest;
    ++calendarRequest;
    state.user = null;
    state.fee = null;
    state.boardSummary = null;
    state.calendar = null;
    state.connection = 'error';
    show();
    document.dispatchEvent(new CustomEvent('vf:navigate', { detail: { id: 'start' } }));
    notice('Testvyn är stängd. Google-kontot är fortfarande inloggat i webbläsaren.');
  });
  document.addEventListener('vf:dashboard-ready', () => {
    window.VFDashboard.authorizeView = async view => {
      const result = await call('authorizeDashboardView', view);
      if (!result || typeof result.allowed !== 'boolean') throw new Error('Ogiltigt behörighetssvar');
      state.user = result.profile || null;
      if (!state.user) {
        state.fee = null;
        state.boardSummary = null;
        state.calendar = null;
      }
      show();
      return result.allowed;
    };
    start();
  });
})();
