/* Vyerna visar bara uppgifter som den skyddade anslutningen tillåter. */
(() => {
  const state = {
    documentTab: 'medlem',
    taskTab: 'medlem',
    messages: [],
    information: null,
  };
  const targets = new Set();
  let currentView = 'start';

  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const paragraph = (text, className = '') => element('p', className, text);
  const button = (text, action, value, pressed) => {
    const node = element('button', '', text);
    node.type = 'button';
    node.dataset.action = action;
    if (value !== undefined) node.dataset.value = String(value);
    if (pressed !== undefined) node.setAttribute('aria-pressed', String(pressed));
    return node;
  };
  const card = (title, body, className = '') => {
    const node = element('section', `view-card ${className}`.trim());
    node.append(element('h3', '', title), paragraph(body));
    return node;
  };
  const heading = title => element('h2', 'view-screen-reader-only', title);
  const notice = () => document.createDocumentFragment();
  const formatEventDate = event => {
    const date = event.allDay && /^\d{4}-\d{2}-\d{2}$/.test(event.start)
      ? new Date(`${event.start}T12:00:00`) : new Date(event.start);
    return new Intl.DateTimeFormat('sv-SE', {
      weekday:'short',day:'numeric',month:'long',
      ...(event.allDay ? {} : {hour:'2-digit',minute:'2-digit'})
    }).format(date);
  };
  const formatEvent = event => `${formatEventDate(event)} · ${event.title}`;
  const nextMeeting = (events, kind) => events.find(event =>
    event.kind === kind && /möte/i.test(event.title) &&
    new Date(event.start).getTime() >= Date.now());
  const group = (...children) => {
    const node = element('div', 'view-actions');
    node.append(...children);
    return node;
  };
  const renderStart = (root, options) => {
    root.append(heading(options.name ? `Hej, ${options.name.split(/\s+/)[0]}` : 'Välkommen', 'Mina sidor'));
    const permissions = new Set(options.user?.permissions || []);
    const isBoard = permissions.has('board_view');
    const events = options.calendar?.events || [];
    if (!isBoard) {
      const grid = element('div', 'view-grid');
      const memberMeeting = nextMeeting(events, 'member');
      const meeting = card('Nästa medlemsmöte', memberMeeting
        ? formatEvent(memberMeeting) : options.calendar?.error
          ? 'Kalendern kunde inte hämtas.' : 'Inget kommande medlemsmöte hittades.');
      meeting.append(button('Öppna kalender', 'navigate', 'kalender'));
      const info = options.information?.message;
      const board = card('Information', info?.text || 'Inget viktigt meddelande publicerat.');
      board.append(button('Öppna information', 'navigate', 'information'));
      grid.append(meeting, board);
      root.append(grid);
    }
    const actions = element('div','view-actions');
    if (isBoard) {
      actions.append(button('Ekonomi','navigate','board'), button('Medlemmar','navigate','kontakt'));
      for (const [kind, title] of [['member', 'Ändra medlemskalender'], ['board', 'Ändra styrelsekalender']]) {
        const url = options.calendar?.links?.[kind];
        if (typeof url !== 'string' || !/^https:\/\/calendar\.google\.com\/calendar\//.test(url)) continue;
        const link = element('a', 'view-calendar-link', title);
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        actions.append(link);
      }
    }
    if (permissions.has('recovery_manage')) actions.append(button('Administration','navigate','admin'));
    if (options.user) actions.append(button(options.connection === 'google_test' ? 'Stäng vyn' : 'Logga ut','signout'));
    root.append(actions, notice());
    if (permissions.has('board_view') && options.connection === 'google_test') {
      const form = element('form', 'view-task-form');
      form.dataset.form = 'task';
      const label = element('label', 'view-screen-reader-only', 'Lägg till uppgift');
      label.htmlFor = 'task-entry-' + root.id;
      const input = element('textarea');
      input.id = label.htmlFor;
      input.name = 'task';
      input.rows = 1;
      input.maxLength = 100;
      input.required = true;
      input.placeholder = 'Skriv en kort uppgift';
      const kindLabel = element('label', 'view-screen-reader-only', 'Lista');
      kindLabel.htmlFor = 'task-kind-' + root.id;
      const kind = element('select');
      kind.id = kindLabel.htmlFor;
      kind.name = 'kind';
      for (const [value, title] of [
        ['medlem', 'Medlem'], ['styrelse', 'Styrelse'], ['prioriterad', 'Prioriterad']
      ]) {
        const choice = element('option', '', title);
        choice.value = value;
        kind.append(choice);
      }
      form.append(label, input, kindLabel, kind,
        button('Lägg till uppgift', 'submit-task'));
      root.append(form);
    }
  };
  const renderCalendar = (root, options) => {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    root.append(heading('Kalender'));
    if (options.calendar?.error) root.append(card('Kalendern kunde inte hämtas', 'Försök igen senare.', 'alert'));
    else if (!options.calendar) root.append(card('Hämtar kalender', 'Vänta ett ögonblick.'));
    else {
      const boardAllowed = options.user?.permissions?.includes('board_view');
      const columns = element('div', 'view-calendar-columns');
      for (const kind of boardAllowed ? ['member', 'board'] : ['member']) {
        const section = element('section', 'view-calendar-section');
        const header = element('div', 'view-calendar-section-header');
        header.append(element('h3', '', kind === 'member' ? 'Medlemskalender' : 'Styrelsekalender'));
        section.append(header);
        const list = element('ul', 'view-calendar-events');
        const events = (options.calendar.events || []).filter(event =>
          event.kind === kind && new Date(event.start) < nextMonth &&
          new Date(event.end) > now);
        if (!events.length) list.append(element('li', 'view-calendar-empty', 'Inga fler händelser denna månad.'));
        for (const event of events) {
          const row = element('li', 'view-calendar-event');
          const date = element('time', '', formatEventDate(event));
          date.dateTime = event.start;
          row.append(date, element('span', '', event.title));
          list.append(row);
        }
        section.append(list);
        columns.append(section);
      }
      root.append(columns);
    }
    root.append(notice());
  };
  const renderTasks = (root, options) => {
    const boardAllowed = options.user?.permissions?.includes('board_view');
    if (!boardAllowed) state.taskTab = 'medlem';
    root.append(heading('Att göra'));
    root.append(group(button('För medlemmar','task-tab','medlem',state.taskTab==='medlem'), ...(boardAllowed ? [button('För styrelsen','task-tab','styrelse',state.taskTab==='styrelse')] : [])));
    const list = element('ul','view-list');
    const tasks = (options.tasks?.tasks || []).filter(task => state.taskTab === 'styrelse'
      ? task.kind === 'styrelse' : task.kind === 'medlem' || task.kind === 'prioriterad')
      .sort((a, b) => Number(b.kind === 'prioriterad') - Number(a.kind === 'prioriterad'));
    if (!options.tasks && options.connection === 'google_test') list.append(element('li','','Hämtar uppgifter…'));
    else if (!tasks.length) list.append(element('li','','Inga uppgifter tillagda.'));
    tasks.forEach(task => {
      const row = element('li','view-row view-task-row');
      const details = element('div');
      if (task.kind === 'prioriterad') details.append(element('span','view-priority','Prioriterad'));
      details.append(element('strong','',`${task.done ? '✓ ' : ''}${task.text}`));
      if (task.done && task.completedBy && task.completedAt) {
        details.append(paragraph(`Utförd av ${task.completedBy} · ${new Intl.DateTimeFormat('sv-SE',{dateStyle:'short',timeStyle:'short'}).format(new Date(task.completedAt))}`, 'view-muted'));
      } else if (task.lastRecall) {
        details.append(paragraph(`Återkallad som felaktig av ${task.lastRecall.name}`, 'view-muted'));
      }
      row.append(details);
      if (options.connection === 'google_test') {
        if (!task.done) row.append(button('Klart','task-complete',task.id));
        else if (task.canRecall) row.append(button('Återkalla','task-recall',task.id));
      }
      list.append(row);
    });
    root.append(list);
  };
  const renderInformation = (root, options) => {
    root.append(heading('Information', 'Viktigt meddelande från styrelsen'));
    if (options.information?.error) root.append(card('Kunde inte läsa information', 'Försök igen senare.', 'alert'));
    else if (!options.information && options.connection === 'google_test') root.append(card('Hämtar information', 'Vänta ett ögonblick.'));
    else {
      const message = options.information?.message || state.information;
      root.append(card(message ? 'Från styrelsen' : 'Ingen information publicerad', message?.text || 'Här visas viktiga meddelanden från styrelsen.'));
      if (message?.createdAt) root.append(paragraph(`${message.name || 'Styrelsen'} · ${new Intl.DateTimeFormat('sv-SE',{dateStyle:'medium',timeStyle:'short'}).format(new Date(message.createdAt))}`, 'view-muted'));
    }
    if (options.user?.permissions?.includes('board_view')) {
      const form = element('form');
      form.dataset.form = 'information';
      const input = element('textarea');
      input.id = 'information-entry-' + root.id;
      input.setAttribute('aria-label', 'Viktigt meddelande');
      input.name = 'information';
      input.maxLength = 600;
      input.required = true;
      input.rows = 4;
      form.append(input,group(button('Skicka viktigt meddelande','submit-information')));
      root.append(form);
    }
  };
  const renderChat = (root, options) => {
    root.append(heading('Chat', 'Korta meddelanden'));
    if (options.chat?.error) root.append(card('Kunde inte läsa Chat', 'Försök igen senare.', 'alert'));
    else if (!options.chat && options.connection === 'google_test') root.append(card('Hämtar Chat', 'Vänta ett ögonblick.'));
    const list = element('ul','view-list');
    const messages = options.chat?.messages || state.messages;
    if (!messages.length) list.append(element('li','','Inga meddelanden ännu.'));
    messages.forEach(item => {
      const row = element('li','view-row view-chat-row');
      row.append(element('strong','',item.name || 'Medlem'),paragraph(item.text || ''));
      if (item.createdAt) row.append(element('time','',new Intl.DateTimeFormat('sv-SE',{dateStyle:'short',timeStyle:'short'}).format(new Date(item.createdAt))));
      list.append(row);
    });
    root.append(list);
    const form = element('form');
    form.dataset.form = 'message';
    const label = element('label','','Nytt kort meddelande');
    label.htmlFor = 'message-entry-' + root.id;
    const input = element('input');
    input.id = label.htmlFor;
    input.name = 'message';
    input.maxLength = 120;
    input.required = true;
    input.placeholder = 'Skriv högst 120 tecken';
    form.append(label,input,group(button('Blir sen','quick-message','Blir sen'),button('Hittar inte dit','quick-message','Hittar inte dit'),button('Behöver hjälp','quick-message','Behöver hjälp'),button('Skicka','submit-message')));
    root.append(form);
  };
  const renderDocuments = (root, options) => {
    const boardAllowed = options.user?.permissions?.includes('board_view');
    if (!boardAllowed) state.documentTab = 'medlem';
    root.append(heading('Dokument', 'Delade filer'));
    root.append(group(button('För medlemmar','document-tab','medlem',state.documentTab==='medlem'),...(boardAllowed ? [button('För styrelsen','document-tab','styrelse',state.documentTab==='styrelse')] : [])));
    root.append(card(state.documentTab === 'medlem' ? 'Medlemsdokument' : 'Styrelsedokument', 'Inga dokument att visa.'));
    root.append(notice());
  };
  const renderFee = root => {
    root.append(heading('Min avgift','Medlemsstatus'));
    const fee = window.VFPreviewViews.options.fee;
    if (!fee) {
      root.append(card('Status saknas', 'Din avgift kunde inte hämtas. Ladda om sidan eller försök senare.', 'alert'));
      return;
    }
    const info = element('div','view-card notice');
    info.append(element('div','view-status-line'));
    info.firstChild.append(element('span','view-status-dot'),element('strong','',fee.status === 'paid' ? 'Medlemsavgift betald' : fee.status === 'unpaid' ? 'Medlemsavgift inte betald' : 'Status okänd'));
    info.dataset.status = fee.status;
    if (fee.remaining > 0) info.append(paragraph(`Återstår: ${new Intl.NumberFormat('sv-SE',{style:'currency',currency:'SEK',maximumFractionDigits:0}).format(fee.remaining)}`));
    if (fee.dueDate) info.append(paragraph(`Förfallodatum: ${new Intl.DateTimeFormat('sv-SE',{year:'numeric',month:'long',day:'numeric'}).format(new Date(`${fee.dueDate}T00:00:00`))}`));
    if (fee.paymentNotice === 'due_soon') info.append(paragraph('Medlemsavgiften behöver snart betalas.'));
    if (fee.paymentNotice === 'overdue') info.append(paragraph('Medlemsavgiften har passerat förfallodatum.'));
    root.append(info,notice());
  };
  const renderBoardSummary = (root, options) => {
    if (!options.user?.permissions?.includes('board_view')) return root.append(heading('Ingen åtkomst','Styrelseöversikt'));
    root.append(heading('Styrelseöversikt','Ekonomi i korthet'));
    if (!options.boardSummary) return root.append(card('Läser uppgifter', 'Vänta ett ögonblick.'));
    if (options.boardSummary.error) return root.append(card('Kunde inte läsa', 'Försök igen senare.', 'alert'));
    const summary = options.boardSummary;
    root.append(card('Period',summary.period));
    const grid = element('div','view-grid');
    const format = value => new Intl.NumberFormat('sv-SE',{style:'currency',currency:'SEK'}).format(value);
    grid.append(card('Bank',format(summary.bank)),card('Kontanter',format(summary.cash)),card('Resultat',format(summary.result)));
    root.append(grid);
  };
  const renderPlanned = (root,title,description) => root.append(heading(title),card(title,description));
  const renderRestricted = (root,options,permission,title,description) => {
    if (!options.user?.permissions?.includes(permission)) return root.append(heading('Ingen åtkomst',title));
    return renderPlanned(root,title,description);
  };
  const renderContact = (root, options) => {
    root.append(heading('Kontakt'));
    const contacts = options.contacts?.contacts;
    if (!contacts) return root.append(paragraph('Hämtar medlemmar…'));
    if (!contacts.length) return root.append(paragraph('Inga aktiva medlemmar att visa.'));
    const list = element('ul', 'view-contact-list');
    for (const contact of contacts) {
      const item = element('li', 'view-contact');
      const initials = contact.name.trim().split(/\s+/).slice(0, 2)
        .map(part => part[0]?.toLocaleUpperCase('sv-SE') || '').join('');
      const avatar = element('span', 'view-contact-avatar', initials);
      avatar.setAttribute('aria-hidden', 'true');
      const details = element('div');
      details.append(element('strong', '', contact.name));
      if (contact.phone && /^[+0-9() .-]{3,40}$/.test(contact.phone)) {
        const link = element('a', '', contact.phone);
        link.href = 'tel:' + contact.phone.replace(/[^+0-9]/g, '');
        details.append(link);
      }
      if (contact.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) {
        const link = element('a', '', contact.email);
        link.href = 'mailto:' + contact.email;
        details.append(link);
      }
      item.append(avatar, details);
      list.append(item);
    }
    root.append(list);
  };
  const renderers = {start:renderStart,kalender:renderCalendar,medlemsarbete:renderTasks,chat:renderChat,information:renderInformation,dokument:renderDocuments,avgift:renderFee,kontakt:renderContact,board:renderBoardSummary,secretary:(root,options)=>renderRestricted(root,options,'members_manage','Medlemmar och roller','Redigering görs direkt i EKO i Google Sheets.'),treasurer:(root,options)=>renderRestricted(root,options,'finance_manage','Kassörens ekonomi','Funktionen är inte tillgänglig ännu.'),admin:(root,options)=>renderRestricted(root,options,'recovery_manage','Administration','Funktionen är inte tillgänglig ännu.')};
  function draw(options = {}) {
    for (const target of targets) {
      const surface = element('div','view-surface');
      surface.id = `${target.id}-view`;
      renderers[currentView]?.(surface,options);
      target.replaceChildren(surface);
    }
  }
  function attach(target) {
    targets.add(target);
    target.addEventListener('click', event => {
      const control = event.target.closest('[data-action]');
      if (!control || !target.contains(control)) return;
      const {action,value} = control.dataset;
      if (action === 'navigate') {
        document.dispatchEvent(new CustomEvent('vf:navigate',{detail:{id:value}}));
        return;
      }
      if (action === 'signout') {
        document.dispatchEvent(new Event('vf:signout'));
        return;
      }
      if (action === 'task-tab') state.taskTab = value;
      else if (action === 'document-tab') state.documentTab = value;
      else if (action === 'task-complete' || action === 'task-recall') {
        const task = window.VFAppData?.tasks?.tasks?.find(item => item.id === value);
        if (!task) return;
        if (action === 'task-complete' && task.done) return;
        if (action === 'task-complete' &&
            !window.confirm('Bekräfta att uppgiften är klar')) return;
        if (action === 'task-recall' && (!task.canRecall || !window.confirm('Återkalla avbockningen som felaktig?'))) return;
        document.dispatchEvent(new CustomEvent(action === 'task-complete'
          ? 'vf:task-complete' : 'vf:task-recall', {detail:{id:value}}));
        return;
      } else if (action === 'quick-message') {
        const form = control.closest('form');
        if (form) { form.querySelector('input').value = value; form.requestSubmit(); }
        return;
      } else if (action === 'submit-task' || action === 'submit-message' || action === 'submit-information') {
        const form = control.closest('form');
        form?.requestSubmit();
        return;
      }
      draw(window.VFPreviewViews.options);
    });
    target.addEventListener('submit', event => {
      const form = event.target.closest('form[data-form]');
      if (!form) return;
      event.preventDefault();
      const input = form.querySelector('input, textarea');
      const text = input.value.trim();
      if (!text) return;
      if (form.dataset.form === 'task') {
        if (!window.VFAppData?.user?.permissions?.includes('board_view')) return;
        if (window.VFAppData.connection === 'google_test') {
          const kind = form.querySelector('select[name="kind"]')?.value;
          if (!['medlem', 'styrelse', 'prioriterad'].includes(kind)) return;
          document.dispatchEvent(new CustomEvent('vf:task-create',
            {detail:{text:text.slice(0,100),kind:kind}}));
          input.value = '';
        }
      }
      else if (form.dataset.form === 'message') {
        if (window.VFAppData?.connection === 'google_test') document.dispatchEvent(new CustomEvent('vf:chat-post',{detail:{text:text.slice(0,120)}}));
        else state.messages.push({name:'Du',text:text.slice(0,120),createdAt:new Date().toISOString()});
      } else if (form.dataset.form === 'information') {
        if (!window.VFAppData?.user?.permissions?.includes('board_view')) return;
        if (window.VFAppData.connection === 'google_test') document.dispatchEvent(new CustomEvent('vf:information-publish',{detail:{text:text.slice(0,600)}}));
        else state.information = {name:'Styrelsen',text:text.slice(0,600),createdAt:new Date().toISOString()};
      }
      draw(window.VFPreviewViews.options);
    });
  }
  window.VFPreviewViews = {
    options:{},
    meetingText(calendar, isBoard = false) {
      if (calendar?.error) return 'Kalendern kunde inte hämtas.';
      if (!calendar) return 'Hämtar mötesuppgifter…';
      const member = nextMeeting(calendar.events || [], 'member');
      if (!isBoard) return member ? formatEvent(member) : 'Inget kommande medlemsmöte hittades.';
      const board = nextMeeting(calendar.events || [], 'board');
      return `Medlem: ${member ? formatEvent(member) : 'Inget möte inlagt'}\nStyrelse: ${board ? formatEvent(board) : 'Inget möte inlagt'}`;
    },
    attach,
    show(id,options = {}) {currentView=id;this.options=options;draw(options);},
    refresh(options = {}) {this.options=options;draw(options);},
  };
})();
