// Den här filen bäddas in i Dashboard.html vid bygget.
(() => {
  const state = { user: null, fee: null, boardSummary: null, calendar: null,
    information: null, chat: null, tasks: null, contacts: null, connection: 'checking' };
  let boardRequest = 0;
  let calendarRequest = 0;
  let informationRequest = 0;
  let chatRequest = 0;
  let tasksRequest = 0;
  let contactsRequest = 0;
  let chatLoading = false;
  let activeView = 'start';

  function show() { window.VFDashboard?.setData(state); }
  function notice(message) {
    const node = document.querySelector('.app-notice');
    if (node) node.textContent = message;
  }
  function closePrivateView() {
    ++boardRequest;
    ++calendarRequest;
    ++informationRequest;
    ++chatRequest;
    ++tasksRequest;
    ++contactsRequest;
    state.user = null;
    state.fee = null;
    state.boardSummary = null;
    state.calendar = null;
    state.information = null;
    state.chat = null;
    state.tasks = null;
    state.contacts = null;
    state.connection = 'error';
    show();
    notice('Åtkomsten kunde inte kontrolleras. Försök logga in på nytt.');
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
    let result;
    try {
      result = await call('readDashboardData', action);
    } catch (_temporaryError) {
      // Ett misslyckat Google-körningsförsök kan vara tillfälligt. Endast läsning
      // får provas igen; ett uttryckligt nekat behörighetssvar provas aldrig om.
      result = await call('readDashboardData', action);
    }
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
      const [profile, fee] = await Promise.all([read('profile'), read('own_fee')]);
      if (!Array.isArray(profile.permissions) || !profile.permissions.includes('own_fee') ||
          typeof fee.memberId !== 'string' || !fee.memberId) {
        throw new Error('Ogiltig medlemsprofil');
      }
      state.user = profile;
      state.fee = fee;
      state.connection = 'google_test';
      show();
      notice('');
      loadCalendar(false);
      loadInformation();
      loadChat();
    } catch (error) {
      state.user = null;
      state.fee = null;
      state.boardSummary = null;
      state.calendar = null;
      state.information = null;
      state.chat = null;
      state.tasks = null;
      state.contacts = null;
      state.connection = 'error';
      show();
      notice(error && error.reason === 'unknown_user' || error && error.reason === 'inactive_user'
        ? 'Kontot har inte tillgång till föreningen.'
        : 'Appen kunde inte öppnas. Försök igen senare.');
    }
  }
  async function loadCalendar(refreshProfile = true) {
    const request = ++calendarRequest;
    if (!state.calendar) window.VFDashboard?.refresh();
    try {
      const [profile, calendar] = await Promise.all([
        refreshProfile ? read('profile') : Promise.resolve(state.user),
        read('calendar'),
      ]);
      if (request !== calendarRequest) return;
      state.user = profile;
      if (!profile.permissions?.includes('board_view')) state.boardSummary = null;
      state.calendar = calendar;
    } catch (error) {
      if (request !== calendarRequest) return;
      closePrivateView();
      return;
    }
    show();
  }
  async function loadBoard() {
    const request = ++boardRequest;
    state.boardSummary = null;
    window.VFDashboard?.refresh();
    try {
      const [profile, summary] = await Promise.all([read('profile'), read('board_summary')]);
      if (request !== boardRequest) return;
      state.user = profile;
      if (!profile.permissions?.includes('board_view')) {
        show();
        document.dispatchEvent(new CustomEvent('vf:navigate', { detail: { id: 'start' } }));
        return;
      }
      state.boardSummary = summary;
    } catch {
      if (request !== boardRequest) return;
      closePrivateView();
      document.dispatchEvent(new CustomEvent('vf:navigate', { detail: { id: 'start' } }));
      return;
    }
    window.VFDashboard?.refresh();
  }

  async function loadInformation() {
    const request = ++informationRequest;
    if (!state.information) show();
    try {
      const information = await read('information');
      if (request !== informationRequest) return;
      state.information = information;
    } catch (error) {
      if (request !== informationRequest) return;
      closePrivateView();
      return;
    }
    show();
  }

  async function loadChat() {
    if (state.connection !== 'google_test' || chatLoading) return;
    chatLoading = true;
    const request = ++chatRequest;
    if (!state.chat) show();
    try {
      const chat = await read('chat');
      if (request !== chatRequest) return;
      state.chat = chat;
    } catch (error) {
      if (request !== chatRequest) return;
      closePrivateView();
      return;
    } finally {
      chatLoading = false;
    }
    show();
  }

  async function loadTasks() {
    if (state.connection !== 'google_test') return;
    const request = ++tasksRequest;
    try {
      const tasks = await read('tasks');
      if (request !== tasksRequest) return;
      state.tasks = tasks;
      show();
    } catch {
      if (request === tasksRequest) closePrivateView();
    }
  }

  async function loadContacts() {
    if (state.connection !== 'google_test') return;
    const request = ++contactsRequest;
    try {
      const contacts = await read('contacts');
      if (request !== contactsRequest) return;
      state.contacts = contacts;
      show();
    } catch {
      if (request === contactsRequest) closePrivateView();
    }
  }

  async function writeTask(method, input) {
    if (state.connection !== 'google_test') return;
    try {
      const result = await call(method, input);
      if (!result || result.allowed !== true) {
        const error = new Error('Uppgiften sparades inte');
        error.reason = result?.reason;
        throw error;
      }
      await loadTasks();
      if (state.connection === 'google_test') notice(method === 'completeTask'
        ? 'Uppgiften markerades som utförd. Du kan välja Återkalla om det blev fel.'
        : method === 'recallTask' ? 'Markeringen återkallades som felaktig.'
          : 'Uppgiften lades till.');
    } catch (error) {
      if (error?.reason === 'already_completed') {
        await loadTasks();
        notice('Någon annan hann markera uppgiften först.');
      } else {
        notice('Ändringen kunde inte bekräftas. Uppdatera listan innan du försöker igen.');
        await loadTasks();
      }
    }
  }

  async function writeMessage(method, text, refresh) {
    if (state.connection !== 'google_test') return;
    try {
      const result = await call(method, text);
      if (!result || result.allowed !== true) throw new Error('Meddelandet sparades inte');
      await refresh();
      if (state.connection === 'google_test') notice('Meddelandet skickat.');
    } catch {
      notice('Meddelandet kunde inte sparas. Försök igen; kontrollera först att det inte redan syns.');
    }
  }

  document.addEventListener('vf:view-selected', event => {
    activeView = event.detail?.id || 'start';
    if (activeView === 'board') loadBoard();
    if (activeView === 'kalender' || activeView === 'start') loadCalendar();
    if (activeView === 'information') loadInformation();
    if (activeView === 'chat') loadChat();
    if (activeView === 'medlemsarbete') loadTasks();
    if (activeView === 'kontakt') loadContacts();
    if (activeView !== 'board') {
      ++boardRequest;
      state.boardSummary = null;
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && activeView === 'board') loadBoard();
    if (!document.hidden && (activeView === 'kalender' || activeView === 'start')) loadCalendar();
    if (!document.hidden && activeView === 'information') loadInformation();
    if (!document.hidden && activeView === 'chat') loadChat();
    if (!document.hidden && activeView === 'medlemsarbete') loadTasks();
    if (!document.hidden && activeView === 'kontakt') loadContacts();
  });
  document.addEventListener('vf:information-publish', event => {
    writeMessage('publishInformation', event.detail?.text, loadInformation);
  });
  document.addEventListener('vf:chat-post', event => {
    writeMessage('postChatMessage', event.detail?.text, loadChat);
  });
  document.addEventListener('vf:task-create', event => {
    writeTask('createTask', event.detail);
  });
  document.addEventListener('vf:task-complete', event => {
    writeTask('completeTask', event.detail?.id);
  });
  document.addEventListener('vf:task-recall', event => {
    writeTask('recallTask', event.detail?.id);
  });
  setInterval(() => { if (!document.hidden && activeView === 'chat') loadChat(); }, 30000);
  document.addEventListener('vf:signout', () => {
    ++boardRequest;
    ++calendarRequest;
    state.user = null;
    state.fee = null;
    state.boardSummary = null;
    state.calendar = null;
    state.information = null;
    state.chat = null;
    state.tasks = null;
    state.contacts = null;
    state.connection = 'error';
    show();
    document.dispatchEvent(new CustomEvent('vf:navigate', { detail: { id: 'start' } }));
    notice('Vyn är stängd. Google-kontot är fortfarande inloggat i webbläsaren.');
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
        state.information = null;
        state.chat = null;
        state.tasks = null;
        state.contacts = null;
      }
      show();
      return result.allowed;
    };
    start();
  });
})();
