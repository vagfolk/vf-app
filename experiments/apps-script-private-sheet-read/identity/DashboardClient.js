// Den här filen bäddas in i Dashboard.html vid bygget.
(() => {
  const state = { user: null, fee: null, boardSummary: null, calendar: null,
    information: null, chat: null, tasks: null, contacts: null,
    versions: null, online: null, connection: 'checking' };
  let updateCheckPromise = null;
  let lastUpdateCheckAt = 0;
  let updateGeneration = 0;
  let calendarDay = '';
  let informationRequest = 0;
  let chatRequest = 0;
  let tasksRequest = 0;
  let contactsRequest = 0;
  let chatLoading = false;

  function show() { window.VFDashboard?.setData(state); }
  function notice(message) {
    const node = document.querySelector('.app-notice');
    if (node) node.textContent = message;
  }
  function closePrivateView() {
    ++updateGeneration;
    ++informationRequest;
    ++chatRequest;
    ++tasksRequest;
    ++contactsRequest;
    state.user = null;
    state.fee = null;
    state.boardSummary = null;
    state.calendar = null;
    calendarDay = '';
    state.information = null;
    state.chat = null;
    state.tasks = null;
    state.contacts = null;
    state.versions = null;
    state.online = null;
    state.connection = 'error';
    show();
    notice('Åtkomsten kunde inte kontrolleras. Försök logga in på nytt.');
  }
  function accessRevoked(error) {
    return ['unknown_user', 'inactive_user', 'duplicate_identity',
      'wrong_association_or_action', 'insufficient_role'].includes(error?.reason);
  }
  function handleReadFailure(error) {
    if (accessRevoked(error)) closePrivateView();
    else notice('Uppdateringen misslyckades. Befintliga uppgifter visas medan appen försöker igen.');
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
      // Starta alla tillåtna grundläsningar direkt medan startfilmen spelas.
      // Varje anrop behörighetskontrolleras fortfarande av dataskriptet.
      const actions = ['profile', 'own_fee', 'calendar', 'information', 'chat',
        'tasks', 'contacts', 'app_versions'];
      const pending = Object.fromEntries(actions.map(action => [action, read(action)]));
      const boardSummary = pending.profile.then(profile =>
        Array.isArray(profile?.permissions) && profile.permissions.includes('board_view')
          ? read('board_summary') : null);
      const loaded = await Promise.all([...actions.map(action => pending[action]), boardSummary]);
      const snapshot = Object.fromEntries([...actions, 'board_summary']
        .map((action, index) => [action, loaded[index]]));
      const profile = snapshot.profile;
      const fee = snapshot.own_fee;
      if (!Array.isArray(profile.permissions) || !profile.permissions.includes('own_fee') ||
          typeof fee.memberId !== 'string' || !fee.memberId) {
        throw new Error('Ogiltig medlemsprofil');
      }
      state.user = profile;
      state.fee = fee;
      state.calendar = snapshot.calendar;
      state.information = snapshot.information;
      state.chat = snapshot.chat;
      state.tasks = snapshot.tasks;
      state.contacts = snapshot.contacts;
      state.boardSummary = snapshot.board_summary || null;
      state.versions = snapshot.app_versions;
      state.online = snapshot.app_versions.online || profile.online || 1;
      calendarDay = new Date().toDateString();
      lastUpdateCheckAt = Date.now();
      state.connection = 'google_test';
      show();
      notice('');
    } catch (error) {
      state.user = null;
      state.fee = null;
      state.boardSummary = null;
      state.calendar = null;
      state.information = null;
      state.chat = null;
      state.tasks = null;
      state.contacts = null;
      state.versions = null;
      state.online = null;
      state.connection = 'error';
      show();
      notice(error && error.reason === 'unknown_user' || error && error.reason === 'inactive_user'
        ? 'Kontot har inte tillgång till föreningen.'
        : 'Appen kunde inte öppnas. Försök igen senare.');
    }
  }
  function checkUpdates(force = false) {
    if (state.connection !== 'google_test' || !state.user || !state.versions ||
        document.hidden) return;
    if (updateCheckPromise) return updateCheckPromise;
    if (!force && Date.now() - lastUpdateCheckAt < 20000) return;
    lastUpdateCheckAt = Date.now();
    const generation = updateGeneration;
    updateCheckPromise = (async () => {
      try {
        const latest = await read('app_versions');
        if (generation !== updateGeneration || state.connection !== 'google_test') return;
        const ekoChanged = latest.eko !== state.versions.eko;
        const storeChanged = latest.store !== state.versions.store;
        const contactsChanged = latest.contacts !== state.versions.contacts;
        const calendarChanged = calendarDay !== new Date().toDateString() ||
          JSON.stringify(latest.calendar) !== JSON.stringify(state.versions.calendar);
        state.online = latest.online;
        if (!ekoChanged && !storeChanged && !calendarChanged && !contactsChanged) {
          state.versions = latest;
          window.VFDashboard?.setOnlineCount?.(state.online);
          return;
        }
        const actions = [];
        if (ekoChanged) actions.push('profile', 'own_fee', 'contacts');
        else if (contactsChanged) actions.push('contacts');
        if (storeChanged) actions.push('information', 'chat', 'tasks');
        if (calendarChanged) actions.push('calendar');
        const loaded = await Promise.all(actions.map(read));
        if (generation !== updateGeneration || state.connection !== 'google_test') return;
        const updated = Object.fromEntries(actions.map((action, index) =>
          [action, loaded[index]]));
        if (ekoChanged) {
          state.user = updated.profile;
          state.fee = updated.own_fee;
          state.contacts = updated.contacts;
          state.boardSummary = state.user.permissions.includes('board_view')
            ? await read('board_summary') : null;
          if (generation !== updateGeneration || state.connection !== 'google_test') return;
        }
        else if (contactsChanged) state.contacts = updated.contacts;
        if (storeChanged) {
          state.information = updated.information;
          state.chat = updated.chat;
          state.tasks = updated.tasks;
        }
        if (calendarChanged) {
          state.calendar = updated.calendar;
          calendarDay = new Date().toDateString();
        }
        state.versions = latest;
        show();
      } catch (error) {
        if (generation === updateGeneration && state.connection === 'google_test') {
          handleReadFailure(error);
        }
      }
    })().finally(() => { updateCheckPromise = null; });
    return updateCheckPromise;
  }
  async function loadInformation(force = false) {
    if (state.connection !== 'google_test' || !state.user) return;
    if (state.information && !force) return;
    const request = ++informationRequest;
    if (!state.information) show();
    try {
      const information = await read('information');
      if (request !== informationRequest) return;
      state.information = information;
    } catch (error) {
      if (request !== informationRequest) return;
      handleReadFailure(error);
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
      handleReadFailure(error);
      return;
    } finally {
      chatLoading = false;
    }
    show();
  }

  async function loadTasks(force = false) {
    if (state.connection !== 'google_test') return;
    if (state.tasks && !force) return;
    const request = ++tasksRequest;
    try {
      const tasks = await read('tasks');
      if (request !== tasksRequest) return;
      state.tasks = tasks;
      show();
    } catch (error) {
      if (request === tasksRequest) handleReadFailure(error);
    }
  }

  async function loadContacts(force = false) {
    if (state.connection !== 'google_test') return;
    if (state.contacts && !force) return;
    const request = ++contactsRequest;
    try {
      const contacts = await read('contacts');
      if (request !== contactsRequest) return;
      state.contacts = contacts;
      show();
    } catch (error) {
      if (request === contactsRequest) handleReadFailure(error);
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
      await loadTasks(true);
      if (state.connection === 'google_test') notice(method === 'completeTask'
        ? 'Uppgiften markerades som utförd. Du kan välja Återkalla om det blev fel.'
        : method === 'recallTask' ? 'Markeringen återkallades som felaktig.'
          : 'Uppgiften lades till.');
    } catch (error) {
      if (error?.reason === 'already_completed') {
        await loadTasks(true);
        notice('Någon annan hann markera uppgiften först.');
      } else {
        notice('Ändringen kunde inte bekräftas. Uppdatera listan innan du försöker igen.');
        await loadTasks(true);
      }
    }
  }

  async function writeContact(method, input) {
    if (state.connection !== 'google_test' ||
        !state.user?.permissions?.includes('board_view')) return;
    try {
      const result = await call(method, input);
      if (!result || result.allowed !== true) {
        const error = new Error('Kontaktkortet sparades inte');
        error.reason = result?.reason;
        throw error;
      }
      await loadContacts(true);
      if (state.connection !== 'google_test') return;
      state.versions = await read('app_versions');
      state.online = state.versions.online;
      show();
      document.dispatchEvent(new CustomEvent('vf:navigate', {
        detail: { id: 'kontakt' }
      }));
      notice(method === 'deleteContact' ? 'Kontaktkortet togs bort.' :
        'Kontaktkortet sparades.');
    } catch (error) {
      handleReadFailure(error);
      if (!accessRevoked(error)) notice('Ändringen kunde inte bekräftas. Kontrollera kortet innan du försöker igen.');
    } finally {
      document.dispatchEvent(new Event('vf:contact-result'));
    }
  }

  async function writeMessage(method, text, refresh) {
    if (state.connection !== 'google_test') return;
    try {
      const result = await call(method, text);
      if (!result || result.allowed !== true) throw new Error('Meddelandet sparades inte');
      await refresh(true);
      if (state.connection === 'google_test') notice('Meddelandet skickat.');
    } catch {
      notice('Meddelandet kunde inte sparas. Försök igen; kontrollera först att det inte redan syns.');
    }
  }

  document.addEventListener('vf:view-selected', event => {
    checkUpdates();
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
  document.addEventListener('vf:contact-save', event => {
    writeContact('saveContact', event.detail);
  });
  document.addEventListener('vf:contact-delete', event => {
    writeContact('deleteContact', event.detail);
  });
  setInterval(() => { if (!document.hidden) checkUpdates(); }, 60000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) checkUpdates(true);
  });
  document.addEventListener('vf:signout', () => {
    call('leaveApp').catch(() => {});
    ++updateGeneration;
    state.user = null;
    state.fee = null;
    state.boardSummary = null;
    state.calendar = null;
    state.information = null;
    state.chat = null;
    state.tasks = null;
    state.contacts = null;
    state.versions = null;
    state.online = null;
    state.connection = 'error';
    show();
    document.dispatchEvent(new CustomEvent('vf:navigate', { detail: { id: 'start' } }));
    notice('Vyn är stängd. Google-kontot är fortfarande inloggat i webbläsaren.');
  });
  document.addEventListener('vf:dashboard-ready', () => {
    window.VFDashboard.startStartup?.();
    window.VFDashboard.authorizeView = async view => {
      const result = await call('authorizeDashboardView', view);
      if (!result || typeof result.allowed !== 'boolean') throw new Error('Ogiltigt behörighetssvar');
      if (!result.allowed) {
        if (accessRevoked(result) || result.reason === 'insufficient_role') {
          closePrivateView();
        }
        return false;
      }
      if (!result.profile || !Array.isArray(result.profile.permissions)) {
        throw new Error('Ogiltig medlemsprofil');
      }
      state.user = result.profile;
      return true;
    };
    start();
  });
})();
