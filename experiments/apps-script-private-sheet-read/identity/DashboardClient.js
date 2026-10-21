// Den här filen bäddas in i Dashboard.html vid bygget.
(() => {
  const state = { user: null, fee: null, boardSummary: null, calendar: null,
    information: null, chat: null, tasks: null, contacts: null,
    documents: null,
    versions: null, online: null, connection: 'checking' };
  let updateCheckPromise = null;
  let lastUpdateCheckAt = 0;
  let updateGeneration = 0;
  let calendarDay = '';
  let informationRequest = 0;
  let chatRequest = 0;
  let tasksRequest = 0;
  let contactsRequest = 0;
  let documentsRequest = 0;
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
    ++documentsRequest;
    state.user = null;
    state.fee = null;
    state.boardSummary = null;
    state.calendar = null;
    calendarDay = '';
    state.information = null;
    state.chat = null;
    state.tasks = null;
    state.contacts = null;
    state.documents = null;
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
  async function readDocuments() {
    try {
      return await read('documents');
    } catch (error) {
      if (accessRevoked(error)) throw error;
      return { documents: [], error: true };
    }
  }
  async function start() {
    try {
      // Starta alla tillåtna grundläsningar direkt medan startfilmen spelas.
      // Varje anrop behörighetskontrolleras fortfarande av dataskriptet.
      const actions = ['profile', 'own_fee', 'calendar', 'information', 'chat',
        'tasks', 'contacts', 'documents', 'app_versions'];
      // Apps Script kan avvisa enstaka samtidiga körningar när alla vyer begärs
      // på en gång. Tre parallella läsningar håller startpaketet i gång utan
      // att belasta samma Google-konto med tio anrop samtidigt.
      const snapshot = {};
      let nextAction = 0;
      await Promise.all(Array.from({length:3}, async () => {
        while (nextAction < actions.length) {
          const action = actions[nextAction++];
          snapshot[action] = action === 'documents' ? await readDocuments() : await read(action);
        }
      }));
      snapshot.board_summary = Array.isArray(snapshot.profile?.permissions) &&
        snapshot.profile.permissions.includes('board_view')
        ? await read('board_summary') : null;
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
      state.documents = snapshot.documents;
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
      state.documents = null;
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
        const documentsChanged = latest.documents !== state.versions.documents;
        const calendarChanged = calendarDay !== new Date().toDateString() ||
          JSON.stringify(latest.calendar) !== JSON.stringify(state.versions.calendar);
        state.online = latest.online;
        if (!ekoChanged && !storeChanged && !calendarChanged &&
            !contactsChanged && !documentsChanged) {
          state.versions = latest;
          window.VFDashboard?.setOnlineCount?.(state.online);
          return;
        }
        const actions = [];
        if (ekoChanged) actions.push('profile', 'own_fee', 'contacts');
        else if (contactsChanged) actions.push('contacts');
        if (storeChanged) actions.push('information', 'chat', 'tasks');
        if (documentsChanged || ekoChanged) actions.push('documents');
        if (calendarChanged) actions.push('calendar');
        const loaded = await Promise.all(actions.map(action =>
          action === 'documents' ? readDocuments() : read(action)));
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
        if (documentsChanged || ekoChanged) {
          state.documents = updated.documents;
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

  async function loadDocuments(force = false) {
    if (state.connection !== 'google_test' || !state.user ||
        (state.documents && !force)) return;
    const request = ++documentsRequest;
    try {
      const documents = await readDocuments();
      if (request !== documentsRequest) return;
      state.documents = documents;
      show();
    } catch (error) {
      if (request === documentsRequest) handleReadFailure(error);
    }
  }

  async function openDocument(id) {
    const selected = state.documents?.documents?.find(item => item.id === id);
    if (state.connection !== 'google_test' || !state.user || !selected) return;
    const browserCanShow = selected.mimeType === 'application/pdf' ||
      selected.mimeType === 'text/plain' || selected.mimeType.startsWith('image/');
    // Öppna fliken medan klicket ännu räknas som användarens åtgärd.
    const browserTab = browserCanShow ? window.open('about:blank', '_blank') : null;
    if (browserTab) browserTab.opener = null;
    try {
      let result = await call('openDocument', id);
      if (result?.reason === 'authorization_expired') {
        await loadDocuments(true);
        result = await call('openDocument', id);
      }
      if (!result || result.allowed !== true || !result.data) {
        const error = new Error('Dokumentet kunde inte öppnas');
        error.reason = result?.reason;
        throw error;
      }
      const data = result.data;
      const binary = atob(data.content);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
      const url = URL.createObjectURL(new Blob([bytes], {type:data.mimeType}));
      if (browserTab && !browserTab.closed) {
        browserTab.location.replace(url);
      } else {
        const link = document.createElement('a');
        link.href = url;
        link.download = data.name;
        link.hidden = true;
        document.body.append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      }
      show();
      notice('');
    } catch (error) {
      if (browserTab && !browserTab.closed) browserTab.close();
      handleReadFailure(error);
      if (!accessRevoked(error)) notice('Dokumentet kunde inte öppnas. Försök igen.');
      show();
    }
  }

  async function uploadDocument(input) {
    if (state.connection !== 'google_test' ||
        !state.user?.permissions?.includes('board_view')) return;
    try {
      const result = await call('uploadDocument', input);
      if (!result || result.allowed !== true) {
        const error = new Error('Dokumentet sparades inte');
        error.reason = result?.reason;
        throw error;
      }
      await loadDocuments(true);
      state.versions = await read('app_versions');
      const listed = state.documents?.documents?.some(item => item.id === result.id);
      state.documentUploadStatus = {busy:false, message: listed
        ? `Uppladdad: ${input.name}`
        : `Uppladdad: ${input.name}. Listan kunde inte uppdateras; ladda om sidan.`};
      show();
    } catch (error) {
      handleReadFailure(error);
      if (!accessRevoked(error)) {
        state.documentUploadStatus = {busy:false,
          message:'Uppladdningen kunde inte bekräftas. Kontrollera listan innan du försöker igen.'};
        show();
      }
    } finally {
      document.querySelectorAll('form[data-form="document"]').forEach(form => {
        form.dataset.busy = 'false';
      });
    }
  }

  async function deleteDocument(id) {
    if (state.connection !== 'google_test' ||
        !state.user?.permissions?.includes('board_view')) return;
    try {
      const result = await call('deleteDocument', id);
      if (!result || result.allowed !== true) {
        const error = new Error('Dokumentet togs inte bort');
        error.reason = result?.reason;
        throw error;
      }
      await loadDocuments(true);
      state.versions = await read('app_versions');
      show();
      notice('Dokumentet togs bort.');
    } catch (error) {
      handleReadFailure(error);
      if (!accessRevoked(error)) notice('Dokumentet kunde inte tas bort. Kontrollera listan innan du försöker igen.');
      show();
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
        ? 'Uppgiften markerades som utförd. Du kan avmarkera kryssrutan om det blev fel.'
        : method === 'recallTask' ? 'Markeringen återkallades som felaktig.'
          : method === 'archiveTask' ? 'Uppgiften godkändes och togs bort från den aktiva listan.'
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
        detail: { id: 'medlemmar' }
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
  document.addEventListener('vf:document-open', event => {
    openDocument(event.detail?.id);
  });
  document.addEventListener('vf:document-retry', () => {
    loadDocuments(true);
  });
  document.addEventListener('vf:document-upload', event => {
    uploadDocument(event.detail);
  });
  document.addEventListener('vf:document-delete', event => {
    deleteDocument(event.detail?.id);
  });
  document.addEventListener('vf:information-publish', event => {
    writeMessage('publishInformation', event.detail?.text, loadInformation);
  });
  document.addEventListener('vf:information-delete', async event => {
    if (state.connection !== 'google_test' ||
        !state.user?.permissions?.includes('board_view')) return;
    try {
      const result = await call('deleteInformation', event.detail?.id);
      if (!result || result.allowed !== true) {
        const error = new Error('Meddelandet togs inte bort');
        error.reason = result?.reason;
        throw error;
      }
      await loadInformation(true);
      notice('Meddelandet togs bort.');
    } catch (error) {
      handleReadFailure(error);
      if (!accessRevoked(error)) {
        notice('Borttagningen kunde inte bekräftas. Kontrollera listan innan du försöker igen.');
        await loadInformation(true);
      }
    }
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
  document.addEventListener('vf:task-archive', event => {
    if (!state.user?.permissions?.includes('board_view')) return;
    writeTask('archiveTask', event.detail?.id);
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
    state.documents = null;
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
