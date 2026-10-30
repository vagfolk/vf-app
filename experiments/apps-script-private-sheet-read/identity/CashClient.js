(() => {
  'use strict';
  const content = document.getElementById('content');
  const message = document.getElementById('message');
  const state = { page: 'overview', cash: null, record: null, cashes: [],
    suggestions: [], viewerMemberId: null, canReview: false, swishEnabled: false, basket: {},
    draftProducts: [], draftFloat: '0', selected: null, pendingSwish: null,
    voidPurchaseId: null, busy: false, storageFailed: false };
  const kroner = cents => new Intl.NumberFormat('sv-SE', {
    style: 'currency', currency: 'SEK'
  }).format(cents / 100);
  const amount = value => {
    const text = String(value || '').trim().replace(',', '.');
    if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(text)) throw Error('Ange ett giltigt belopp');
    const [whole, decimals = ''] = text.split('.');
    const cents = Number(whole) * 100 + Number(decimals.padEnd(2, '0'));
    if (!Number.isSafeInteger(cents) || cents > 100000000) throw Error('Beloppet är för stort');
    return cents;
  };
  const node = (tag, text, className) => {
    const e = document.createElement(tag);
    if (text != null) e.textContent = text;
    if (className) e.className = className;
    return e;
  };
  const line = (...children) => { const e = node('div', null, 'row'); e.append(...children); return e; };
  const panel = (...children) => { const e = node('section', null, 'panel'); e.append(...children); return e; };
  const button = (label, action, className = '') => {
    const e = node('button', label, className); e.type = 'button'; e.addEventListener('click', action); return e;
  };
  const field = (label, type = 'text', value = '') => {
    const wrap = node('label'); wrap.append(node('span', label));
    const input = node('input'); input.type = type; input.value = value;
    if (type === 'number') { input.min = '0'; input.step = '0.01'; input.inputMode = 'decimal'; }
    wrap.append(input); return { wrap, input };
  };
  const clear = () => { content.replaceChildren(); };
  function notice(text, error = false) { message.textContent = text; message.classList.toggle('error', error); }
  function call(action, input) {
    return new Promise((resolve, reject) => {
      if (!window.google?.script?.run) return reject(Error('Google-anslutning saknas'));
      google.script.run.withSuccessHandler(resolve).withFailureHandler(reject)
        .cashRequest(action, input);
    });
  }
  async function request(action, input) {
    const reply = await call(action, input);
    if (!reply || reply.allowed !== true) {
      const explanations = {
        cash_swish_not_booked:'En eller flera Swishbetalningar saknas i EKO.',
        cash_swish_eko_conflict:'En Swishrad i EKO har fel belopp, datum, kategori eller status.',
        cash_eko_conflict:'En tidigare kontantpost med samma referens avviker i EKO.',
        cash_eko_full:'Kassaboken i EKO har inga lediga rader.',
        cash_eko_write_unverified:'Skrivningen till EKO kunde inte verifieras. Försök igen; ingen dubblett ska skapas.',
        cash_eko_category_missing:'Försäljning är inte en aktiv kategori i EKO.',
        cash_eko_period_mismatch:'Kassans öppningsdatum ligger utanför EKO:s räkenskapsperiod.',
        cash_eko_structure_changed:'EKO:s kassabok har ändrats. Överföringen är stoppad.',
        cash_recovery_pending:'Säljarens enhet har inte bekräftat att lokala köp synkats. Styrelsen kan markera enheten som förlorad om den inte går att återfå.',
        cash_swish_disabled:'Swish är inte aktiverat för föreningen.',
        cash_qr_unavailable:'Swish-koden kunde inte hämtas. Prova igen eller använd kontantbetalning.',
      };
      throw Error(explanations[reply?.reason] || reply?.reason || 'Åtgärden misslyckades');
    }
    return reply.data || {};
  }
  const DB_NAME = 'vf26-cash-v1';
  let dbPromise;
  function database() {
    if (!dbPromise) dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore('registers', { keyPath: 'id' });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }
  async function store(method, value) {
    const db = await database();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('registers', method === 'getAll' ? 'readonly' : 'readwrite');
      const req = method === 'getAll'
        ? tx.objectStore('registers').getAll() : tx.objectStore('registers')[method](value);
      let result;
      req.onsuccess = () => { result = req.result; };
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || Error('Lokal lagring avbröts'));
    });
  }
  function deviceId() {
    let value = localStorage.getItem('vf26-cash-device');
    if (!value) { value = crypto.randomUUID(); localStorage.setItem('vf26-cash-device', value); }
    return value;
  }
  async function remember(record) {
    // Bekräfta aldrig ett köp i minnet innan hela IndexedDB-transaktionen är klar.
    await store('put', record);
    state.record = record;
    state.cash = record.cash;
  }
  async function setPendingSwish(value) {
    if (state.record) await remember({ ...state.record, pendingSwish:value });
    state.pendingSwish = value;
  }
  async function refreshList() {
    const result = await request('cash_list');
    state.cashes = result.cashes || [];
    state.viewerMemberId = result.viewerMemberId;
    state.canReview = result.canReview === true;
    document.querySelector('[data-page="review"]').hidden = !state.canReview;
    state.swishEnabled = result.swishEnabled === true;
    state.suggestions = result.products || [];
  }
  async function selectCash(id) {
    const result = await request('cash_get', { cashId: id });
    state.selected = result.cash;
    state.page = 'detail'; render();
  }
  function localEvent(event) {
    const cash = state.cash;
    if (event.kind === 'add_product') return VFCashCore.addCashProduct(cash, event.product,
      event.operationId, event.at);
    if (event.kind === 'update_product') return VFCashCore.updateCashProduct(cash,
      event.productId, event.priceCents, event.operationId, event.at);
    if (event.kind === 'purchase') return VFCashCore.recordCashPurchase(cash,
      { ...event, swishEnabled: state.swishEnabled });
    if (event.kind === 'void') return VFCashCore.voidCashPurchase(cash, event);
    if (event.kind === 'close') return VFCashCore.closeCashRegister(cash, event);
    throw Error('Okänd kassahändelse');
  }
  async function appendEvent(event) {
    if (!state.cash || !state.record) throw Error('Ingen öppen kassa');
    if (state.storageFailed) throw Error('Lokal lagring misslyckades. Avbryt försäljningen och använd reservfilen för avstämning.');
    if (!VFCashBackup.active(state.cash.id)) throw Error('Välj en fungerande reservfil innan fler händelser registreras');
    const enriched = { ...event, operationId: crypto.randomUUID(),
      at: new Date().toISOString() };
    if (enriched.kind === 'close') enriched.expectedEventCount = state.cash.events.length;
    const next = localEvent(enriched);
    const clearQr = enriched.kind === 'purchase' || enriched.kind === 'close';
    const record = { ...state.record, cash: next,
      pendingSwish: clearQr ? null : state.record.pendingSwish || null,
      queue: [...state.record.queue, enriched] };
    try { await VFCashBackup.write(record); }
    catch (error) { render(); throw error; }
    // Separat fil på enheten före webbläsarens databas.
    try { await remember(record); }
    catch (_error) {
      state.storageFailed = true;
      throw Error('Reservfilen sparades, men webbläsarens lagring misslyckades. Avbryt försäljningen och stäm av filen manuellt.');
    }
    if (clearQr) state.pendingSwish = null;
    notice(navigator.onLine ? 'Sparat på enheten. Synkar…' : 'Sparat på enheten. Väntar på synk.');
    render();
    await sync();
  }
  let syncing = false;
  let retryTimer = null;
  function needsRetry() {
    return state.record?.queue?.length > 0 ||
      (state.cash?.status === 'aborted_pending_review' &&
        !state.cash.abort?.deviceLost && !state.cash.abort?.recoveryCompleteAt);
  }
  function scheduleRetry() {
    if (retryTimer || !needsRetry() || !navigator.onLine || document.hidden) return;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      sync();
    }, 15000);
  }
  function cancelRetry() {
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = null;
  }
  async function confirmRecovery() {
    if (!state.record || state.record.queue.length || !navigator.onLine ||
        state.cash?.abort?.recoveryCompleteAt) return;
    const remote = state.cashes.find(item => item.id === state.record.id);
    if (remote?.status !== 'aborted_pending_review') return;
    const result = await request('cash_recovery_done', {
      cashId: state.record.id, deviceId: deviceId()
    });
    await remember({ ...state.record, cash: result.cash });
    await refreshList();
    render(); notice('Alla lokala köp har lämnats till den avbrutna kassans logg.');
  }
  async function sync() {
    if (syncing || !navigator.onLine || !state.record) return;
    cancelRetry();
    syncing = true;
    try {
      while (state.record.queue.length) {
        const event = state.record.queue[0];
        const result = await request('cash_event', {
          cashId: state.cash.id, deviceId: state.cash.deviceId, event
        });
        const rest = state.record.queue.slice(1);
        const remaining = { ...state.record, cash: rest.length ? state.cash : result.cash,
          queue: rest };
        await remember(remaining);
        if (VFCashBackup.active(remaining.id)) await VFCashBackup.write(remaining);
      }
      await refreshList();
      await confirmRecovery();
      render();
      notice('Synkad');
    } catch (error) {
      render();
      notice(state.record.queue.length
        ? 'Väntar på synk: ' + error.message
        : 'Köpen är överförda, men kassans status behöver kontrolleras igen: ' + error.message,
      true);
    } finally {
      syncing = false;
      scheduleRetry();
    }
  }
  async function run(task) {
    if (state.busy) return;
    state.busy = true;
    try { await task(); }
    catch (error) { notice(error.message || 'Åtgärden misslyckades', true); }
    finally { state.busy = false; }
  }
  function drawOverview() {
    content.append(node('h2', 'Försäljningskassor'));
    content.append(button('Uppdatera', () => run(async () => { await refreshList(); render(); })));
    const active = state.cashes.filter(item => item.status === 'open');
    const pending = state.cashes.filter(item => item.status !== 'open');
    content.append(node('h3', `Öppna kassor (${active.length})`));
    for (const item of active) content.append(cashSummary(item));
    content.append(node('h3', `Avslutade kassor (${pending.length})`));
    for (const item of pending) content.append(cashSummary(item));
    if (!state.cashes.length) content.append(node('p', 'Inga kassor finns ännu.', 'muted'));
  }
  function cashSummary(item) {
    return panel(node('strong', item.id), node('p', `${item.ownerName} · ${item.accountingDate} · ${item.status}`),
      button('Visa logg', () => run(() => selectCash(item.id))));
  }
  function drawSetup() {
    content.append(node('h2', 'Öppna ny kassa'));
    const opening = field('Växelkassa, totalsumma i kronor', 'number', state.draftFloat);
    opening.input.addEventListener('input', () => { state.draftFloat = opening.input.value; });
    const name = field('Vara'); const price = field('Pris i kronor', 'number');
    const suggestions = node('datalist'); suggestions.id = 'cash-suggestions';
    for (const item of state.suggestions) {
      const option = node('option'); option.value = item.name;
      suggestions.append(option);
    }
    name.input.setAttribute('list', suggestions.id);
    name.input.addEventListener('change', () => {
      const found = state.suggestions.find(item => item.name.toLowerCase() === name.input.value.toLowerCase());
      if (found) price.input.value = String(found.priceCents / 100);
    });
    content.append(opening.wrap, line(name.wrap, price.wrap,
      button('Lägg till vara', () => run(async () => {
        const item = { id: crypto.randomUUID(), name: name.input.value.trim(),
          priceCents: amount(price.input.value) };
        const year = new Date().getFullYear();
        VFCashCore.openCashRegister({ id: `K-${year}-0001`, associationId: 'local-setup',
          ownerMemberId: 'local-setup', deviceId: 'local-setup',
          openedAt: new Date().toISOString(), accountingDate: `${year}-01-01`, openingFloatCents: 0,
          products: [...state.draftProducts, item] });
        state.draftProducts.push(item); name.input.value = ''; price.input.value = '';
        render();
      }))), suggestions);
    const list = node('div', null, 'list');
    for (const item of state.draftProducts) list.append(line(
      node('span', `${item.name} · ${kroner(item.priceCents)}`),
      button('Ta bort', () => {
        state.draftProducts = state.draftProducts.filter(p => p.id !== item.id);
        render();
      })));
    const open = button('Starta och godkänn kassa', () => run(async () => {
      if (!VFCashBackup.supported()) throw Error('Reservfil kräver Chrome på Android eller dator');
      if (!navigator.onLine) throw Error('Nätanslutning krävs för att öppna kassan');
      await database();
      const requestId = sessionStorage.getItem('vf26-pending-open') || crypto.randomUUID();
      sessionStorage.setItem('vf26-pending-open', requestId);
      const result = await request('cash_open', { requestId, deviceId: deviceId(),
        openingFloatCents: amount(opening.input.value), products: state.draftProducts });
      await remember({ id: result.cash.id, cash: result.cash, queue: [] });
      sessionStorage.removeItem('vf26-pending-open');
      state.draftProducts = []; state.draftFloat = '0'; state.page = 'register';
      await refreshList(); notice('Kassan är öppen.'); render();
    }), 'primary');
    open.disabled = !VFCashBackup.supported();
    content.append(list, open);
    if (open.disabled) content.append(node('p',
      'Den här webbläsaren kan inte skapa en fristående reservfil. Öppna kassan i Chrome på Android eller dator.', 'muted'));
  }
  function drawRegister() {
    if (!state.cash) return drawSetup();
    const cash = state.cash;
    if (state.storageFailed) content.append(panel(node('strong', 'Lokal lagring misslyckades'),
      node('p', 'Fortsätt inte sälja från denna enhet. Reservfilen innehåller den senaste händelsen och kan användas för avstämning.')));
    else if (!VFCashBackup.active(cash.id)) {
      const backup = panel(node('strong', 'Reservfil för kassan'),
        node('p', VFCashBackup.supported()
          ? 'Välj en fil på denna enhet. Den uppdateras före varje köp och rensas när Google har bekräftat händelserna.'
          : 'Denna webbläsare kan inte skriva en separat reservfil. Använd Chrome på Android eller dator.'));
      if (VFCashBackup.supported()) backup.append(button('Välj reservfil', () => run(async () => {
        await VFCashBackup.choose(state.record);
        render(); notice('Reservfilen är aktiv.');
      })));
      content.append(backup);
    } else content.append(node('p', 'Reservfil aktiv på denna enhet.', 'muted'));
    content.append(node('h2', `Kassa ${cash.id}`),
      node('p', `${state.record?.queue.length
        ? `Väntar på synk · ${state.record.queue.length} händelser sparade på enheten`
        : cash.status === 'open' && !navigator.onLine ? 'Offline · kassan öppen · inga väntande händelser'
          : cash.status === 'open' ? 'Synkad · kassan öppen'
          : cash.status === 'pending_sync' ? 'Avslutad · väntar på synk'
            : cash.status === 'aborted_pending_review' ? 'Avbruten · väntar på återhämtning'
              : 'Synkad · väntar på kassörens granskning'}`, 'muted'));
    const totals = VFCashCore.cashTotals(cash);
    content.append(panel(node('strong', 'Kontantkassa'),
      node('p', `Växelkassa ${kroner(totals.openingFloatCents)} · Förväntat ${kroner(totals.expectedCashCents)}`),
      node('p', `Swish enligt kassan ${kroner(totals.swishReceiptsCents)}`)));
    if (cash.status !== 'open') {
      content.append(node('p', state.record?.queue.length
        ? 'Avslut sparat lokalt. Väntar på synk och kontroll.'
        : 'Kassan är avslutad och väntar på kassörens granskning.'));
      return;
    }
    const name = field('Ny vara'); const price = field('Pris i kronor', 'number');
    const suggestions = node('datalist'); suggestions.id = 'cash-open-suggestions';
    for (const item of state.suggestions) {
      const choice = node('option'); choice.value = item.name; suggestions.append(choice);
    }
    name.input.setAttribute('list', suggestions.id);
    name.input.addEventListener('change', () => {
      const found = state.suggestions.find(item =>
        item.name.toLowerCase() === name.input.value.toLowerCase());
      if (found) price.input.value = String(found.priceCents / 100);
    });
    content.append(node('h3', 'Varor'), suggestions, line(name.wrap, price.wrap,
      button('Lägg till vara', () => run(async () => {
        await appendEvent({ kind:'add_product', product: { id:crypto.randomUUID(),
          name:name.input.value.trim(), priceCents:amount(price.input.value) } });
      }))));
    const goods = node('div', null, 'grid');
    for (const product of cash.products) {
      const qty = state.basket[product.id] || 0;
      const output = node('output', String(qty));
      const minus = button('−', () => run(async () => {
        await setPendingSwish(null);
        state.basket[product.id] = Math.max(0, (state.basket[product.id] || 0) - 1);
        render();
      }));
      const plus = button('+', () => run(async () => {
        await setPendingSwish(null);
        state.basket[product.id] = Math.min(10000, qty + 1);
        render();
      }));
      goods.append(panel(node('strong', product.name),
        node('p', kroner(product.priceCents)), line(minus, output, plus)));
    }
    content.append(goods);
    const selected = cash.products.filter(p => state.basket[p.id] > 0);
    const sale = selected.reduce((sum, p) => sum + p.priceCents * state.basket[p.id], 0);
    content.append(node('h3', `Nytt köp · ${kroner(sale)}`));
    const received = field('Mottaget kontantbelopp i kronor', 'number', String(sale / 100));
    const pay = button('Betalt kontant', () => run(async () => {
      if (!selected.length) throw Error('Välj minst en vara');
      const receivedCents = amount(received.input.value);
      if (receivedCents < sale) throw Error('Mottaget belopp är för lågt');
      if (!confirm(`Köp ${kroner(sale)}. Växel ${kroner(receivedCents - sale)}. Registrera som betalt?`)) return;
      await appendEvent({ kind:'purchase', id:crypto.randomUUID(), method:'Kontant',
        receivedCents, lines:selected.map(p => ({ productId:p.id, quantity:state.basket[p.id] })) });
      state.basket = {}; render();
    }), 'primary');
    content.append(line(received.wrap, pay));
    if (state.swishEnabled) {
      const saleLines = selected.map(p => ({ productId:p.id, quantity:state.basket[p.id] }));
      if (!state.pendingSwish) content.append(button('Betala med Swish', () => run(async () => {
        if (!saleLines.length) throw Error('Välj minst en vara');
        if (!navigator.onLine) throw Error('Anslutning krävs för att skapa Swish-koden');
        await sync();
        if (state.record?.queue.length) throw Error('Vänta tills tidigare köp har synkats');
        const purchaseId = crypto.randomUUID();
        const result = await request('cash_qr', { cashId:cash.id,
          deviceId:deviceId(), purchaseId, lines:saleLines });
        if (result.amountCents !== sale || !result.image?.startsWith('data:image/png;base64,')) {
          throw Error('Swish-beloppet kunde inte verifieras');
        }
        await setPendingSwish({ ...result, lines:saleLines });
        render();
      })));
      else {
        const pending = state.pendingSwish;
        const matchesBasket = pending.amountCents === sale &&
          JSON.stringify(pending.lines) === JSON.stringify(saleLines);
        const qr = node('img'); qr.className = 'qr'; qr.src = pending.image;
        qr.alt = `Swish-QR för ${kroner(pending.amountCents)}`;
        const qrPanel = panel(node('strong', `Swish ${kroner(pending.amountCents)}`),
          node('p', pending.reference), qr);
        if (!matchesBasket) qrPanel.append(node('p',
          'Varukorgen har ändrats. Avbryt och skapa en ny QR-kod.', 'muted'));
        const controls = [];
        if (matchesBasket) controls.push(button('Betalt', () => run(async () => {
            if (!confirm('Har kunden visat att Swishbetalningen är genomförd?')) return;
            await appendEvent({ kind:'purchase', id:pending.purchaseId,
              method:'Swish', lines:pending.lines,
              qrAmountCents:pending.amountCents });
            state.basket = {}; render();
          }), 'primary'));
        controls.push(button('Avbryt', () => run(async () => {
          await setPendingSwish(null); render();
        })));
        qrPanel.append(line(...controls));
        content.append(qrPanel);
      }
    } else content.append(node('p', 'Swish kan väljas när föreningens Swishnummer har aktiverats.', 'muted'));
    content.append(node('h3', 'Köp och makulering'));
    for (const purchase of [...cash.purchases].reverse()) {
      const body = panel(node('strong', `${purchase.id} · ${kroner(purchase.totalCents)}`),
        node('p', `${purchase.lines.map(l => `${l.name} ${l.quantity} st`).join(', ')} · ${purchase.method}`));
      if (purchase.void) body.append(node('p', `Makulerat: ${purchase.void.reason}`));
      else if (state.voidPurchaseId === purchase.id) {
        const reason = field('Orsak till makulering');
        const payment = node('select');
        for (const [value, label] of [['', 'Välj betalningsstatus'],
          ['yes', 'Betalning mottagen – återbetala kontant'],
          ['no', 'Betalning inte mottagen – ingen återbetalning']]) {
          const option = node('option', label); option.value = value; payment.append(option);
        }
        const paymentLabel = node('label');
        paymentLabel.append(node('span', 'Betalning och återbetalning'), payment);
        body.append(reason.wrap, paymentLabel, line(
          button('Bekräfta makulering', () => run(async () => {
            if (!reason.input.value.trim()) throw Error('Ange orsak till makulering');
            if (!payment.value) throw Error('Välj om betalningen togs emot');
            const paymentReceived = payment.value === 'yes';
            await appendEvent({ kind:'void', purchaseId:purchase.id,
              reason:reason.input.value.trim(), paymentReceived,
              refundMethod:paymentReceived ? 'Kontant' : null });
            state.voidPurchaseId = null; render();
          }), 'danger'),
          button('Avbryt', () => { state.voidPurchaseId = null; render(); })));
      } else body.append(button('Makulera', () => {
        state.voidPurchaseId = purchase.id; render();
      }, 'danger'));
      content.append(body);
    }
    const counted = field('Räknade kontanter vid avslut, kronor', 'number');
    const closer = field('Avslutarens medlemsnummer');
    content.append(node('h3', 'Avsluta kassa'), line(counted.wrap, closer.wrap),
      button('Avsluta kassa', () => run(async () => {
        if (!confirm('Vill du verkligen avsluta kassan? Den stängs för ytterligare transaktioner.')) return;
        await appendEvent({ kind:'close', countedCashCents:amount(counted.input.value),
          closerMemberId:closer.input.value.trim() });
      }), 'danger'));
  }
  function drawControl() {
    content.append(node('h2', 'Kontroll över öppna kassor'));
    for (const item of state.cashes.filter(c => c.status === 'open')) {
      content.append(panel(node('strong', `${item.id} · ${item.ownerName}`),
        button('Visa', () => run(() => selectCash(item.id))),
        button('Avbryt kassa', () => run(async () => {
          const reason = prompt('Ange varför kassan avbryts');
          if (!reason?.trim() || !confirm('Avbryt den öppna kassan?')) return;
          const deviceLost = confirm('Är enheten trasig eller förlorad så att lokala köp kan saknas?');
          const result = await request('cash_abort', { cashId:item.id,
            operationId:crypto.randomUUID(), reason:reason.trim(), deviceLost });
          if (state.cash?.id === item.id) await remember({ ...state.record, cash:result.cash });
          await refreshList(); render(); notice('Kassan avbröts och finns kvar i loggen.');
        }), 'danger')));
    }
    const waiting = state.cashes.filter(c => c.status === 'aborted_pending_review' &&
      !c.deviceLost && !c.recoveryCompleteAt);
    if (waiting.length) content.append(node('h3', 'Avbrutna kassor'));
    for (const item of waiting) {
      content.append(panel(node('strong', `${item.id} · ${item.ownerName}`),
        button('Visa', () => run(() => selectCash(item.id))),
        button('Enheten kan inte återfås', () => run(async () => {
          const reason = prompt('Beskriv varför lokala köp inte kan hämtas');
          if (!reason?.trim() || !confirm('Markera enheten som förlorad? Kassören måste kontrollera försäljningen manuellt.')) return;
          const result = await request('cash_mark_lost', { cashId:item.id,
            reason:reason.trim() });
          if (state.selected?.id === item.id) state.selected = result.cash;
          await refreshList(); render();
        }), 'danger')));
    }
  }
  function drawReview() {
    content.append(node('h2', 'Avslutade kassor'));
    if (!state.canReview) {
      content.append(node('p', 'Kassör eller administratör granskar och godkänner avslutade kassor.'));
      return;
    }
    for (const item of state.cashes.filter(c => c.status !== 'open')) {
      content.append(panel(node('strong', `${item.id} · ${item.status}`),
        node('p', `Swish enligt kassan ${kroner(item.swishReceiptsCents)}`),
        button('Granska', () => run(() => selectCash(item.id)))));
    }
  }
  function drawDetail() {
    const cash = state.selected; if (!cash) return drawOverview();
    const totals = VFCashCore.cashTotals(cash);
    content.append(node('h2', `Kassa ${cash.id}`),
      node('p', `${cash.ownerName} · öppnad ${cash.openedAt} · ${cash.status}`),
      node('p', `Växelkassa ${kroner(totals.openingFloatCents)} · kontantförsäljning ${kroner(totals.cashSalesCents)} · kontanta återbetalningar ${kroner(totals.cashRefundsCents)}`),
      node('p', `Kontanter förväntat ${kroner(totals.expectedCashCents)} · Swish enligt köp ${kroner(totals.swishReceiptsCents)}`),
      button('Skriv ut kassalogg', () => window.print()));
    if (cash.close) content.append(node('p', `Avslutad av ${cash.close.closerName || cash.close.closerMemberId} · räknat ${kroner(cash.close.countedCashCents)}`));
    if (cash.review) content.append(node('p', `Granskad ${cash.review.at} · kontantavvikelse ${kroner(cash.review.cashDifferenceCents)} · Swishavvikelse ${kroner(cash.review.swishDifferenceCents)}`));
    if (cash.posting) content.append(node('p', `Bokföring ${cash.posting.at} · ${cash.posting.reference}`));
    if (cash.abort) content.append(node('p', `Avbruten: ${cash.abort.reason}`));
    if (cash.abort && !cash.abort.deviceLost && !cash.abort.recoveryCompleteAt &&
        cash.status === 'aborted_pending_review') {
      content.append(node('p', 'Väntar på att säljarens enhet synkar sina lokala köp före kassörens granskning.'));
    }
    content.append(node('h3', 'Sålda varor'));
    for (const product of totals.products) content.append(node('p',
      `${product.name} · ${product.quantity} st · ${product.method} · ${kroner(product.amountCents)}`));
    content.append(node('h3', 'Köp'));
    for (const purchase of cash.purchases) content.append(panel(
      node('strong', `${purchase.id} · ${purchase.at} · ${purchase.method} · ${kroner(purchase.totalCents)}`),
      node('p', purchase.lines.map(l => `${l.name} ${l.quantity} st`).join(', ')),
      ...(purchase.void ? [node('p', `Makulerat ${purchase.void.at}: ${purchase.void.reason} · betalning mottagen: ${purchase.void.paymentReceived ? 'ja' : 'nej'} · återbetalt kontant ${kroner(purchase.void.refundCents)}`)] : [])));
    if (!state.canReview) return;
    if (cash.status === 'pending_cashier' || cash.status === 'aborted_pending_review') {
      const bank = field('Kontrollerad mottagen Swishsumma från banken, kronor', 'number');
      const counted = cash.status === 'aborted_pending_review'
        ? field('Räknade kontanter efter avbrottet, kronor', 'number') : null;
      content.append(bank.wrap);
      if (counted) content.append(counted.wrap,
        node('p', 'Avbruten kassa kräver alltid manuell utredning och verifikation.'));
      content.append(button('Granska och godkänn', () => run(async () => {
        const result = await request('cash_review', { cashId:cash.id,
          operationId:crypto.randomUUID(), bankSwishCents:amount(bank.input.value),
          ...(counted ? { countedCashCents:amount(counted.input.value) } : {}) });
        state.selected = result.cash; await refreshList(); render();
      }), 'primary'));
    }
    if (cash.status === 'approved_for_posting') {
      const plan = VFCashCore.buildCashPostingPlan(cash);
      if (!cash.cashPosting) {
        content.append(node('h3', 'Kontantförsäljning till EKO'),
          node('p', `${plan.rows.length} kontantposter · netto ${kroner(plan.cashMovementCents)}`),
          button('För över kontantposter', () => run(async () => {
            if (!confirm('För över de godkända kontantposterna till EKO?')) return;
            const result = await request('cash_post', { cashId: cash.id });
            state.selected = result.cash; await refreshList(); render();
            notice('Kontantposterna är kontrollerade mot EKO.');
          }), 'primary'));
      } else if (plan.swishForManual.length) {
        content.append(node('p', 'Kontantposterna är överförda och kontrollerade mot EKO.'));
      }
      if (plan.swishForManual.length) {
        content.append(node('h3', 'Swishbetalningar att bokföra i EKO'),
          node('p', 'Bokför varje mottagen betalning som en egen Inkomst/Swish-rad med hela beloppet, en aktiv kategori och exakt referens nedan. EKO hanterar avgiften.'));
        for (const payment of plan.swishForManual) {
          content.append(panel(node('strong', `${kroner(payment.amountCents)} · ${payment.reference}`),
            node('p', payment.description),
            ...(payment.refundedInCash ? [node('p', 'Återbetald kontant; Swishinsättningen ska ändå bokföras.')] : [])));
        }
        if (cash.cashPosting) content.append(button('Kontrollera bokförda Swishbetalningar', () => run(async () => {
          const result = await request('cash_verify_swish', { cashId: cash.id });
          state.selected = result.cash; await refreshList(); render();
          notice('Alla Swishbetalningar finns som separata poster i EKO.');
        }), 'primary'));
      }
    }
    if (cash.status === 'manual_review') {
      const voucher = field('Verifikationsnummer efter manuell utredning');
      content.append(voucher.wrap, button('Registrera manuell bokföring', () => run(async () => {
        const result = await request('cash_manual_book', { cashId:cash.id,
          operationId:crypto.randomUUID(), voucher:voucher.input.value.trim() });
        state.selected = result.cash; await refreshList(); render();
      })));
    }
  }
  function render() {
    clear();
    for (const tab of document.querySelectorAll('nav button')) {
      tab.setAttribute('aria-current', tab.dataset.page === state.page ? 'page' : 'false');
    }
    if (state.page === 'overview') drawOverview();
    else if (state.page === 'register') drawRegister();
    else if (state.page === 'control') drawControl();
    else if (state.page === 'review') drawReview();
    else drawDetail();
  }
  document.querySelectorAll('nav button').forEach(tab => tab.addEventListener('click', () => {
    state.page = tab.dataset.page; render();
  }));
  window.addEventListener('online', () => {
    notice('Anslutningen är tillbaka. Synkar…');
    render();
    sync();
  });
  window.addEventListener('offline', () => {
    cancelRetry();
    render();
    notice('Anslutningen saknas. Köp och avslut sparas på enheten tills nätet är tillbaka.');
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) cancelRetry();
    else sync();
  });
  async function start() {
    try {
      await database(); deviceId();
      // Hämta aktuell EKO-identitet innan lokal kassadata från en delad enhet visas.
      await refreshList();
      const local = await store('getAll');
      const current = local.find(r => r.cash?.deviceId === deviceId() &&
        r.cash?.ownerMemberId === state.viewerMemberId &&
        (r.cash.status === 'open' || r.queue?.length));
      if (current) {
        state.record = current; state.cash = current.cash;
        state.pendingSwish = current.pendingSwish || null;
        if (state.pendingSwish) state.basket = Object.fromEntries(
          state.pendingSwish.lines.map(item => [item.productId, item.quantity]));
      }
      const remote = state.cash && state.cashes.find(item => item.id === state.cash.id);
      if (remote && !state.record.queue.length && remote.status !== state.cash.status) {
        const latest = await request('cash_get', { cashId:state.cash.id });
        await remember({ ...state.record, cash:latest.cash });
      }
      if (!state.cash) {
        const owned = state.cashes.find(c => c.status === 'open' &&
          c.ownerMemberId === state.viewerMemberId &&
          local.some(r => r.id === c.id && r.cash?.deviceId === deviceId()));
        if (owned) {
          const result = await request('cash_get', { cashId:owned.id });
          await remember({ id:owned.id, cash:result.cash, queue:[] });
        }
      }
      render();
      if (needsRetry()) {
        if (navigator.onLine) await sync();
        else notice('Händelserna är sparade på enheten och väntar på synk.');
      } else notice('Kassan är klar att användas.');
    } catch (error) { notice('Kassan kunde inte startas: ' + error.message, true); }
  }
  start();
})();
