/* Vyerna visar bara uppgifter som den skyddade anslutningen tillåter. */
(() => {
  const state = {
    messages: [],
    information: null,
    editingCard: null,
    taskFormOpen: false,
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
    // Den skyddade appen får inte rita en medlemsvy innan profilen är känd.
    // Annars blinkar medlemskort fram för en styrelseanvändare under laddning.
    if (options.connection && !options.user) return;
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
      actions.append(button('Ekonomi','navigate','board'), button('Medlemmar','navigate','medlemmar'),
        button('Viktigt meddelande','navigate','information'));
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
    actions.append(isBoard
      ? button('Att göra', 'open-task-form')
      : button('Att göra', 'navigate', 'medlemsarbete'));
    if (permissions.has('recovery_manage')) actions.append(button('Administration','navigate','admin'));
    if (options.user && options.connection !== 'google_test') actions.append(button('Logga ut','signout'));
    root.append(actions, notice());
    if (isBoard && options.connection === 'google_test' && state.taskFormOpen) {
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
    root.append(heading('Att göra'));
    const tasks = (options.tasks?.tasks || [])
      .filter(task => boardAllowed || task.kind !== 'styrelse');
    const section = (kind, title) => {
      const area = element('section', `view-task-section view-task-${kind}`);
      area.append(element('h3', '', title));
      const list = element('ul', 'view-task-list');
      const matches = tasks.filter(task => task.kind === kind);
      if (!matches.length) list.append(element('li', 'view-task-empty', 'Inga uppgifter.'));
      for (const task of matches) {
        const row = element('li', 'view-task-row');
        const label = element('label', 'view-task-label');
        const checkbox = element('input');
        checkbox.type = 'checkbox';
        checkbox.checked = Boolean(task.done);
        checkbox.disabled = options.connection !== 'google_test' ||
          (task.done && !task.canRecall);
        checkbox.dataset.action = 'task-toggle';
        checkbox.dataset.value = String(task.id);
        checkbox.setAttribute('aria-label', `${task.done ? 'Återkalla' : 'Markera klar'}: ${task.text}`);
        label.append(checkbox, element('span', '', task.text));
        row.append(label);
        if (boardAllowed && task.done && options.connection === 'google_test') {
          const review = element('div', 'view-task-review');
          if (task.completedBy) {
            review.append(element('span', 'view-task-completer',
              `Utförd av ${task.completedBy}${task.completedAt ? ` · ${new Date(task.completedAt).toLocaleString('sv-SE')}` : ''}`));
          }
          const archive = element('button', 'view-task-archive', 'Godkänn och arkivera');
          archive.type = 'button';
          archive.dataset.action = 'task-archive';
          archive.dataset.value = String(task.id);
          review.append(archive);
          row.append(review);
        }
        list.append(row);
      }
      area.append(list);
      return area;
    };
    const layout = element('div', 'view-task-layout');
    layout.append(section('prioriterad', 'Prioriterade'));
    const lower = element('div', `view-task-lower${boardAllowed ? ' view-task-lower-board' : ''}`);
    lower.append(section('medlem', 'Medlemmar'));
    if (boardAllowed) lower.append(section('styrelse', 'Styrelsen'));
    layout.append(lower);
    root.append(layout);
  };
  const renderInformation = (root, options) => {
    root.append(heading('Information', 'Viktigt meddelande från styrelsen'));
    const boardAllowed = options.user?.permissions?.includes('board_view');
    const message = options.information?.message || state.information;
    if (options.information?.error) {
      root.append(card('Kunde inte läsa information', 'Försök igen senare.', 'alert'));
      return;
    }
    if (!options.information && options.connection === 'google_test') {
      root.append(card('Hämtar information', 'Vänta ett ögonblick.'));
      return;
    }
    if (boardAllowed) {
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
      const history = element('section', 'view-information-history');
      history.append(element('h3', '', 'Publicerade meddelanden'));
      const list = element('ul', 'view-information-list');
      const messages = options.information?.messages || (message ? [message] : []);
      if (!messages.length) list.append(element('li', 'view-information-empty', 'Inga meddelanden publicerade.'));
      for (const item of messages) {
        const row = element('li', 'view-information-item');
        row.append(paragraph(item.text));
        if (item.createdAt) row.append(paragraph(`${item.name || 'Styrelsen'} · ${new Intl.DateTimeFormat('sv-SE',{dateStyle:'medium',timeStyle:'short'}).format(new Date(item.createdAt))}`, 'view-muted'));
        if (options.connection === 'google_test') row.append(button('Ta bort', 'delete-information', item.id));
        list.append(row);
      }
      history.append(list);
      root.append(history);
    } else {
      root.append(card(message ? 'Från styrelsen' : 'Ingen information publicerad',
        message?.text || 'Här visas viktiga meddelanden från styrelsen.'));
      if (message?.createdAt) root.append(paragraph(`${message.name || 'Styrelsen'} · ${new Intl.DateTimeFormat('sv-SE',{dateStyle:'medium',timeStyle:'short'}).format(new Date(message.createdAt))}`, 'view-muted'));
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
    const compose = element('div', 'view-chat-compose');
    compose.append(input, button('Skicka', 'submit-message'));
    const shortcuts = group(button('Blir sen','quick-message','Blir sen'),
      button('Hittar inte dit','quick-message','Hittar inte dit'),
      button('Behöver hjälp','quick-message','Behöver hjälp'));
    shortcuts.className += ' view-chat-shortcuts';
    form.append(label, compose, shortcuts);
    root.append(form);
  };
  const renderDocuments = (root, options) => {
    const boardAllowed = options.user?.permissions?.includes('board_view');
    root.append(heading('Dokument', 'Delade filer'));
    const columns = element('div', `view-document-columns${boardAllowed ? ' view-document-columns-board' : ''}`);
    const section = (kind, title) => {
      const area = element('section', `view-document-section view-document-${kind}`);
      area.append(element('h3', '', title), paragraph('Inga dokument att visa.', 'view-document-empty'));
      return area;
    };
    columns.append(section('member', 'Medlemsdokument'));
    if (boardAllowed) columns.append(section('board', 'Styrelsedokument'));
    root.append(columns);
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
  const contactForm = (contact = null) => {
    const form = element('form', 'view-contact-form');
    form.dataset.form = 'contact';
    form.dataset.cardId = contact?.cardId || '';
    form.dataset.memberId = contact?.memberId || '';
    form.dataset.updateEko = String(Boolean(contact?.memberId));
    const fields = [
      ['name', 'Namn', 80, contact?.name || ''],
      ['memberId', 'Medlems-ID i EKO', 80, contact?.memberId || ''],
      ['phone', 'Telefon', 40, contact?.phone || ''],
      ['email', 'E-post', 120, contact?.email || '']
    ];
    for (const [key, title, max, value] of fields) {
      const label = element('label', '', title);
      const input = element('input');
      input.name = key;
      input.maxLength = max;
      input.value = value;
      input.id = `contact-${key}-${contact?.cardId || contact?.memberId || 'new'}`;
      label.htmlFor = input.id;
      if (key === 'name') input.required = true;
      if (key === 'memberId' && contact?.memberId) input.readOnly = true;
      if (key === 'name' && contact?.memberId) input.readOnly = true;
      if (key === 'email') input.type = 'email';
      if (key === 'phone') input.type = 'tel';
      form.append(label, input);
    }
    const descriptionLabel = element('label', '', 'Kort beskrivning');
    const description = element('textarea');
    description.name = 'description';
    description.maxLength = 400;
    description.rows = 3;
    description.value = contact?.description || '';
    description.id = `contact-description-${contact?.cardId || contact?.memberId || 'new'}`;
    descriptionLabel.htmlFor = description.id;
    form.append(descriptionLabel, description);
    const photoLabel = element('label', '', 'Välj foto från galleri');
    const photo = element('input');
    photo.type = 'file';
    photo.name = 'gallery';
    photo.accept = 'image/*';
    photoLabel.append(photo);
    const cameraLabel = element('label', '', 'Ta nytt foto');
    const camera = element('input');
    camera.type = 'file';
    camera.name = 'camera';
    camera.accept = 'image/*';
    camera.setAttribute('capture', 'environment');
    cameraLabel.append(camera);
    form.append(photoLabel, cameraLabel);
    if (contact?.avatar) {
      const remove = element('label', 'view-contact-remove-photo', 'Ta bort nuvarande foto');
      const checkbox = element('input');
      checkbox.type = 'checkbox';
      checkbox.name = 'removePhoto';
      remove.prepend(checkbox);
      form.append(remove);
    }
    form.append(group(button('Spara medlemskort', 'submit-contact')));
    return form;
  };
  const renderMemberCardCreate = (root, options) => {
    if (!options.user?.permissions?.includes('board_view')) return;
    root.append(heading('Medlemmar'));
    root.append(paragraph('Skapa ett kontaktkort. Ange Medlems-ID om personen redan finns i EKO.'));
    root.append(contactForm());
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
      const avatar = contact.avatar ? element('img', 'view-contact-avatar') :
        element('span', 'view-contact-avatar', initials);
      if (contact.avatar) {
        avatar.src = 'data:image/jpeg;base64,' + contact.avatar;
        avatar.alt = '';
      }
      avatar.setAttribute('aria-hidden', 'true');
      const details = element('div');
      details.append(element('strong', '', contact.name));
      if (contact.description) details.append(paragraph(contact.description, 'view-contact-description'));
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
      if (options.user?.permissions?.includes('board_view')) {
        const cardKey = contact.cardId || `eko:${contact.memberId}`;
        const editing = state.editingCard === cardKey;
        const controls = group(button('Redigera', 'edit-contact',
          cardKey),
        button('Ta bort', 'delete-contact',
          cardKey),
        ...(editing ? [button('Stäng', 'close-contact-editor')] : []));
        controls.classList.add('view-contact-controls');
        item.append(controls);
        if (editing) {
          item.append(contactForm(contact));
        }
      }
      list.append(item);
    }
    root.append(list);
  };
  const renderers = {start:renderStart,kalender:renderCalendar,medlemsarbete:renderTasks,chat:renderChat,information:renderInformation,dokument:renderDocuments,avgift:renderFee,kontakt:renderContact,medlemmar:renderMemberCardCreate,board:renderBoardSummary,secretary:(root,options)=>renderRestricted(root,options,'members_manage','Medlemmar och roller','Redigering görs direkt i EKO i Google Sheets.'),treasurer:(root,options)=>renderRestricted(root,options,'finance_manage','Kassörens ekonomi','Funktionen är inte tillgänglig ännu.'),admin:(root,options)=>renderRestricted(root,options,'recovery_manage','Administration','Funktionen är inte tillgänglig ännu.')};
  document.addEventListener('vf:contact-result', () => {
    for (const form of document.querySelectorAll('form[data-form="contact"]')) {
      form.dataset.busy = 'false';
    }
  });
  function draw(options = {}) {
    for (const target of targets) {
      const surface = element('div','view-surface');
      surface.id = `${target.id}-view`;
      renderers[currentView]?.(surface,options);
      target.replaceChildren(surface);
    }
  }
  async function contactPhoto_(file) {
    if (!file || !file.type.startsWith('image/') || file.size > 10000000) {
      throw new Error('Välj en bild på högst 10 MB.');
    }
    const url = URL.createObjectURL(file);
    const image = new Image();
    try {
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
        image.src = url;
      });
      if (!image.naturalWidth || !image.naturalHeight) throw new Error('Bilden kunde inte öppnas.');
      const jpeg = (limit, maxLength) => {
        let size = limit;
        for (let attempt = 0; attempt < 9; attempt++) {
          const scale = Math.min(1, size / Math.max(image.naturalWidth, image.naturalHeight));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
          canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
          canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
          const base64 = canvas.toDataURL('image/jpeg', .82 - Math.min(4, attempt) * .08).split(',')[1];
          if (base64 && base64.length <= maxLength) return base64;
          size *= .78;
        }
        throw new Error('Bilden kunde inte göras tillräckligt liten.');
      };
      return { photo: jpeg(512, 120000), avatar: jpeg(160, 16000) };
    } finally { URL.revokeObjectURL(url); }
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
      if (action === 'open-task-form') {
        if (!window.VFAppData?.user?.permissions?.includes('board_view')) return;
        state.taskFormOpen = true;
        draw(window.VFPreviewViews.options);
        target.querySelector('.view-task-form textarea')?.focus();
        return;
      }
      if (action === 'close-contact-editor') {
        state.editingCard = null;
        draw(window.VFPreviewViews.options);
        return;
      }
      if (action === 'signout') {
        document.dispatchEvent(new Event('vf:signout'));
        return;
      }
      if (action === 'delete-information') {
        if (!window.VFAppData?.user?.permissions?.includes('board_view') ||
            window.VFAppData.connection !== 'google_test' ||
            !window.confirm('Ta bort det viktiga meddelandet? Det försvinner för alla medlemmar.')) return;
        control.disabled = true;
        document.dispatchEvent(new CustomEvent('vf:information-delete', {detail:{id:value}}));
        return;
      }
      if (action === 'edit-contact' || action === 'delete-contact') {
        if (!window.VFAppData?.user?.permissions?.includes('board_view')) return;
        const contact = window.VFAppData?.contacts?.contacts?.find(item =>
          (item.cardId || `eko:${item.memberId}`) === value);
        if (!contact) return;
        if (action === 'edit-contact') {
          state.editingCard = state.editingCard === value ? null : value;
          draw(window.VFPreviewViews.options);
        } else if (window.confirm(`Ta bort kontaktkortet för ${contact.name}?`)) {
          document.dispatchEvent(new CustomEvent('vf:contact-delete', {
            detail: {cardId: contact.cardId, memberId: contact.memberId}
          }));
        }
        return;
      }
      if (action === 'task-toggle') {
        const task = window.VFAppData?.tasks?.tasks?.find(item => item.id === value);
        if (!task) { control.checked = false; return; }
        const actionName = task.done ? 'task-recall' : 'task-complete';
        const allowed = task.done ? task.canRecall : true;
        const confirmed = allowed && window.confirm(task.done
          ? 'Återkalla avbockningen som felaktig?'
          : 'Bekräfta att uppgiften är klar');
        if (!confirmed) { control.checked = Boolean(task.done); return; }
        control.disabled = true;
        document.dispatchEvent(new CustomEvent(actionName === 'task-complete'
          ? 'vf:task-complete' : 'vf:task-recall', {detail:{id:value}}));
        return;
      } else if (action === 'task-archive') {
        if (!window.VFAppData?.user?.permissions?.includes('board_view') ||
            window.VFAppData.connection !== 'google_test') return;
        const task = window.VFAppData?.tasks?.tasks?.find(item => item.id === value);
        if (!task?.done || !window.confirm('Godkänn att uppgiften är utförd och arkivera den? Den försvinner från Att göra men finns kvar i uppgiftsloggen.')) return;
        control.disabled = true;
        document.dispatchEvent(new CustomEvent('vf:task-archive', {detail:{id:value}}));
        return;
      } else if (action === 'quick-message') {
        const form = control.closest('form');
        if (form) { form.querySelector('input').value = value; form.requestSubmit(); }
        return;
      } else if (action === 'submit-task' || action === 'submit-message' ||
          action === 'submit-information' || action === 'submit-contact') {
        const form = control.closest('form');
        form?.requestSubmit();
        return;
      }
      draw(window.VFPreviewViews.options);
    });
    target.addEventListener('submit', async event => {
      const form = event.target.closest('form[data-form]');
      if (!form) return;
      event.preventDefault();
      if (form.dataset.form === 'contact') {
        if (!window.VFAppData?.user?.permissions?.includes('board_view') ||
            form.dataset.busy === 'true') return;
        form.dataset.busy = 'true';
        try {
          const files = Array.from(form.querySelectorAll('input[type=file]'))
            .map(input => input.files?.[0]).filter(Boolean);
          const image = files.length ? await contactPhoto_(files[files.length - 1]) :
            { photo: '', avatar: '' };
          const field = name => form.elements.namedItem(name)?.value?.trim() || '';
          document.dispatchEvent(new CustomEvent('vf:contact-save', { detail: {
            cardId: form.dataset.cardId || '', memberId: field('memberId'),
            name: field('name'), description: field('description'),
            phone: field('phone'), email: field('email'),
            photo: image.photo, avatar: image.avatar,
            removePhoto: Boolean(form.elements.namedItem('removePhoto')?.checked) && !files.length,
            updateEko: form.dataset.updateEko === 'true'
          }}));
        } catch (error) {
          form.dataset.busy = 'false';
          window.alert(error.message || 'Bilden kunde inte läsas.');
        }
        return;
      }
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
    show(id,options = {}) {
      if (id !== 'start' || !options.user?.permissions?.includes('board_view')) {
        state.taskFormOpen = false;
      }
      if (id !== 'kontakt') state.editingCard = null;
      currentView=id;
      this.options=options;
      draw(options);
    },
    refresh(options = {}) {this.options=options;draw(options);},
  };
})();
