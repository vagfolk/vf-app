/* Fungerande vyer för gränssnittsprovet. Inga föreningsuppgifter läses eller sparas. */
(() => {
  const state = {
    month: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    day: new Date().getDate(),
    documentTab: 'medlem',
    taskTab: 'medlem',
    tasks: [],
    messages: [],
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
  const heading = (title, kicker) => {
    const fragment = document.createDocumentFragment();
    fragment.append(paragraph(kicker, 'view-kicker'), element('h2', '', title));
    return fragment;
  };
  const notice = () => paragraph('Teknisk testversion med låtsasdata. Kalender, dokument och övriga föreningsfunktioner är ännu inte anslutna.', 'view-muted');
  const group = (...children) => {
    const node = element('div', 'view-actions');
    node.append(...children);
    return node;
  };
  const renderStart = (root, options) => {
    root.append(heading(options.name ? `Hej, ${options.name.split(/\s+/)[0]}` : 'Välkommen', 'Mina sidor'));
    root.append(paragraph(options.connection === 'unavailable'
      ? 'Välj en funktion i menyn. Inloggning och EKO är ännu inte anslutna till den här publicerade vyn.'
      : 'Välj en funktion i menyn. Egen avgift och styrelsens ekonomiöversikt använder låtsasdata i den skyddade testservern.'));
    const grid = element('div', 'view-grid');
    const meeting = card('Nästa möte', 'Mötesuppgifter är ännu inte anslutna.');
    meeting.append(button('Öppna kalender', 'navigate', 'kalender'));
    const board = card('Från styrelsen', 'Meddelanden från styrelsen är ännu inte anslutna.');
    board.append(button('Öppna snabbtavlan', 'navigate', 'snabbtavla'));
    grid.append(meeting, board);
    root.append(grid);
    const permissions = new Set(options.user?.permissions || []);
    const actions = element('div','view-actions');
    if (permissions.has('board_view')) actions.append(button('Styrelseöversikt','navigate','board'));
    if (permissions.has('members_manage')) actions.append(button('Medlemmar och roller','navigate','secretary'));
    if (permissions.has('finance_manage')) actions.append(button('Kassörens ekonomi','navigate','treasurer'));
    if (permissions.has('recovery_manage')) actions.append(button('Administration','navigate','admin'));
    if (options.user) actions.append(button('Logga ut','signout'));
    root.append(actions, notice());
  };
  const renderCalendar = root => {
    root.append(heading('Kalender', 'Möten och aktiviteter'));
    const nav = element('div', 'view-calendar-header');
    nav.append(button('‹', 'month', -1), element('strong', '', new Intl.DateTimeFormat('sv-SE', {month:'long',year:'numeric'}).format(state.month)), button('›', 'month', 1));
    root.append(nav);
    const calendar = element('div', 'view-calendar');
    const weekdays = ['M','T','O','T','F','L','S'];
    weekdays.forEach(day => calendar.append(element('span', 'weekday', day)));
    const offset = (state.month.getDay() + 6) % 7;
    const days = new Date(state.month.getFullYear(), state.month.getMonth() + 1, 0).getDate();
    for (let index = 0; index < offset; index++) calendar.append(element('span'));
    const today = new Date();
    for (let day = 1; day <= days; day++) {
      const dayButton = button(String(day), 'day', day, day === state.day);
      if (day === state.day) dayButton.classList.add('selected');
      if (day === today.getDate() && state.month.getMonth() === today.getMonth() && state.month.getFullYear() === today.getFullYear()) dayButton.classList.add('today');
      calendar.append(dayButton);
    }
    root.append(calendar);
    const chosen = new Date(state.month.getFullYear(), state.month.getMonth(), Math.min(state.day,days));
    root.append(card(new Intl.DateTimeFormat('sv-SE',{weekday:'long',day:'numeric',month:'long'}).format(chosen), 'Mötes- och aktivitetsuppgifter är ännu inte anslutna.'), notice());
  };
  const renderTasks = (root, options) => {
    const boardAllowed = options.user?.permissions?.includes('board_view');
    if (!boardAllowed) state.taskTab = 'medlem';
    root.append(heading('Att göra', 'Uppgifter'));
    root.append(group(button('För medlemmar','task-tab','medlem',state.taskTab==='medlem'), ...(boardAllowed ? [button('För styrelsen','task-tab','styrelse',state.taskTab==='styrelse')] : [])));
    root.append(paragraph('Övningsläge: uppgifter du lägger till visas bara i denna öppna sida. Inget skickas till föreningen eller sparas.','view-muted'));
    const list = element('ul','view-list');
    const tasks = state.tasks.filter(task => task.kind === state.taskTab);
    if (!tasks.length) list.append(element('li','','Inga övningsuppgifter tillagda.'));
    tasks.forEach(task => {
      const row = element('li','view-row');
      const label = element('span','',`${task.done ? '✓ ' : ''}${task.text}`);
      const toggle = button(task.done ? 'Ångra' : 'Klart','task-toggle',task.id);
      row.append(label,toggle);
      list.append(row);
    });
    root.append(list);
    const form = element('form');
    form.dataset.form = 'task';
    const label = element('label','','Lägg till en övningsuppgift');
    label.htmlFor = 'task-entry-' + root.id;
    const input = element('input');
    input.id = label.htmlFor;
    input.name = 'task';
    input.maxLength = 100;
    input.required = true;
    input.placeholder = 'Skriv en kort uppgift';
    form.append(label,input,group(button('Lägg till','submit-task')));
    root.append(form);
  };
  const renderBoard = root => {
    root.append(heading('Snabbtavla', 'Korta meddelanden'));
    root.append(paragraph('Övningsläge: meddelanden syns bara på denna öppna sida. Ingen annan medlem får dem.','view-muted'));
    const list = element('ul','view-list');
    if (!state.messages.length) list.append(element('li','','Inga övningsmeddelanden.'));
    state.messages.forEach(item => list.append(element('li','',item)));
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
    form.append(label,input,group(button('Blir sen','quick-message','Blir sen'),button('Hittar inte dit','quick-message','Hittar inte dit'),button('Behöver hjälp','quick-message','Behöver hjälp'),button('Visa här','submit-message')));
    root.append(form);
  };
  const renderDocuments = (root, options) => {
    const boardAllowed = options.user?.permissions?.includes('board_view');
    if (!boardAllowed) state.documentTab = 'medlem';
    root.append(heading('Dokument', 'Delade filer'));
    root.append(group(button('För medlemmar','document-tab','medlem',state.documentTab==='medlem'),...(boardAllowed ? [button('För styrelsen','document-tab','styrelse',state.documentTab==='styrelse')] : [])));
    root.append(card(state.documentTab === 'medlem' ? 'Medlemsdokument' : 'Styrelsedokument', state.documentTab === 'medlem' ? 'Godkända dokument kommer att visas här efter anslutning till Drive.' : 'Styrelsens dokument kräver inloggning och serverkontrollerad behörighet innan de kan visas.'));
    root.append(notice());
  };
  const renderFee = root => {
    root.append(heading('Min avgift','Medlemsstatus'));
    const fee = window.VFPreviewViews.options.fee;
    if (!fee) {
      root.append(card('Status saknas', window.VFPreviewViews.options.connection === 'unavailable'
        ? 'Inloggning och EKO är ännu inte anslutna till den här publicerade vyn.'
        : 'Din avgift kunde inte hämtas. Ladda om sidan eller försök senare.', 'alert'));
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
    info.append(paragraph('Detta är låtsasdata från den tekniska testservern.','view-muted'));
    root.append(info,notice());
  };
  const renderBoardSummary = (root, options) => {
    if (!options.user?.permissions?.includes('board_view')) return root.append(heading('Ingen åtkomst','Styrelseöversikt'));
    root.append(heading('Styrelseöversikt','Ekonomi i korthet'));
    if (!options.boardSummary) return root.append(card('Läser uppgifter', 'Översikten hämtas från testservern.'));
    if (options.boardSummary.error) return root.append(card('Kunde inte läsa', 'Försök igen senare.', 'alert'));
    const summary = options.boardSummary;
    root.append(card('Period',summary.period));
    const grid = element('div','view-grid');
    const format = value => new Intl.NumberFormat('sv-SE',{style:'currency',currency:'SEK'}).format(value);
    grid.append(card('Bank',format(summary.bank)),card('Kontanter',format(summary.cash)),card('Resultat',format(summary.result)));
    root.append(grid,paragraph('Endast låtsasdata från den behörighetskontrollerade testservern.','view-muted'));
  };
  const renderPlanned = (root,title,description) => root.append(heading(title,'Under uppbyggnad'),card(title,description),notice());
  const renderRestricted = (root,options,permission,title,description) => {
    if (!options.user?.permissions?.includes(permission)) return root.append(heading('Ingen åtkomst',title));
    return renderPlanned(root,title,description);
  };
  const renderContact = root => {
    root.append(heading('Kontakt','Styrelsen'));
    root.append(card('Kontaktuppgifter', 'Styrelsens godkända kontaktuppgifter kommer att visas här när de är anslutna.'));
    root.append(notice());
  };
  const renderers = {start:renderStart,kalender:renderCalendar,medlemsarbete:renderTasks,snabbtavla:renderBoard,dokument:renderDocuments,avgift:renderFee,kontakt:renderContact,board:renderBoardSummary,secretary:(root,options)=>renderRestricted(root,options,'members_manage','Medlemmar och roller','Redigering görs direkt i den privata EKO-filen i Google Sheets.'),treasurer:(root,options)=>renderRestricted(root,options,'finance_manage','Kassörens ekonomi','Läsning av hela EKO är ännu inte ansluten.'),admin:(root,options)=>renderRestricted(root,options,'recovery_manage','Administration','Säker reservåtkomst och återställning är ännu inte byggda.')};
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
      if (action === 'month') {
        state.month = new Date(state.month.getFullYear(),state.month.getMonth()+Number(value),1);
        state.day = 1;
      } else if (action === 'day') state.day = Number(value);
      else if (action === 'task-tab') state.taskTab = value;
      else if (action === 'document-tab') state.documentTab = value;
      else if (action === 'task-toggle') {
        const task = state.tasks.find(item => item.id === Number(value));
        if (task) task.done = !task.done;
      } else if (action === 'quick-message') {
        state.messages.push(value);
      } else if (action === 'submit-task' || action === 'submit-message') {
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
      const input = form.querySelector('input');
      const text = input.value.trim();
      if (!text) return;
      if (form.dataset.form === 'task') state.tasks.push({id:Date.now()+Math.random(),text:text.slice(0,100),kind:state.taskTab,done:false});
      else state.messages.push(text.slice(0,120));
      draw(window.VFPreviewViews.options);
    });
  }
  window.VFPreviewViews = {
    options:{},
    attach,
    show(id,options = {}) {currentView=id;this.options=options;draw(options);},
    refresh(options = {}) {this.options=options;draw(options);},
  };
})();
