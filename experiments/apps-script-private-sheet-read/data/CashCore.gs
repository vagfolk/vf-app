// Genererad från källmodulerna i src/cash-*.mjs.
// Ändra källmodulerna och kör build-cash-core.mjs igen.
var VFCashCore = (() => {
// Kassans beräkningar är fristående från gränssnitt, Drive och EKO.
// Alla belopp anges i hela ören. Servern måste dessutom kontrollera roll,
// förening, medlemsnummer, unik kassa/enhet och varje skrivnings ordning.
const ID = /^[A-Za-z0-9_-]{3,80}$/;
const CASH_ID = /^K-(\d{4})-(\d{4,})$/;
const METHODS = new Set(['Kontant', 'Swish']);

function fail(message) { throw new Error(message); }
function cents(value, label, positive = false) {
  if (!Number.isSafeInteger(value) || value < (positive ? 1 : 0) || value > 100000000) {
    fail(`Ogiltigt ${label}`);
  }
  return value;
}
function string(value, label, max = 120) {
  if (typeof value !== 'string' || !value.trim() || value.length > max ||
      /[\u0000-\u001f\u007f]/.test(value)) fail(`Ogiltigt ${label}`);
  return value.trim();
}
function identifier(value, label) {
  if (typeof value !== 'string' || !ID.test(value)) fail(`Ogiltigt ${label}`);
  return value;
}
function timestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT/.test(value) ||
      !Number.isFinite(Date.parse(value))) fail('Ogiltig tid');
  return value;
}
function copy(register) { return JSON.parse(JSON.stringify(register)); }
function requireOpen(register) {
  if (register?.status !== 'open') fail('Kassan är inte öppen');
}
function requireUnused(register, operationId) {
  identifier(operationId, 'händelse-ID');
  return !register.events.some(event => event.id === operationId);
}
function repeated(register, operationId, expected) {
  const prior = register.events.find(event => event.id === operationId);
  if (!prior) return false;
  if (JSON.stringify(prior) !== JSON.stringify(expected)) fail('Händelse-ID har annat innehåll');
  return true;
}
function append(register, event) {
  const next = copy(register);
  next.events.push(event);
  return next;
}

function openCashRegister(input) {
  const id = string(input?.id, 'kassa-ID', 32);
  const match = CASH_ID.exec(id);
  if (!match || Number(match[2]) < 1) fail('Ogiltigt kassa-ID');
  const openedAt = timestamp(input.openedAt);
  const accountingDate = string(input.accountingDate, 'bokföringsdatum', 10);
  if (!/^\d{4}-\d\d-\d\d$/.test(accountingDate) ||
      accountingDate.slice(0, 4) !== match[1]) fail('Kassa-ID och öppningsår skiljer sig');
  if (!Array.isArray(input.products) || input.products.length > 100) fail('Ogiltiga produkter');
  const register = {
    id, associationId: identifier(input.associationId, 'förening'),
    ownerMemberId: identifier(input.ownerMemberId, 'öppnare'),
    deviceId: identifier(input.deviceId, 'enhet'),
    openedAt, accountingDate, openingFloatCents: cents(input.openingFloatCents, 'växelkassa'),
    status: 'open', products: [], purchases: [], events: [], close: null,
    review: null, posting: null,
  };
  for (const product of input.products) {
    register.products.push(validProduct(product, register.products));
  }
  return register;
}

function validProduct(product, existing) {
  const id = identifier(product?.id, 'produkt-ID');
  if (existing.some(item => item.id === id)) fail('Produkt-ID används redan');
  return { id, name: string(product.name, 'produktnamn', 80),
    priceCents: cents(product.priceCents, 'pris', true) };
}

function addCashProduct(register, product, operationId, at) {
  requireOpen(register);
  identifier(operationId, 'händelse-ID');
  const item = { id: identifier(product?.id, 'produkt-ID'),
    name: string(product.name, 'produktnamn', 80),
    priceCents: cents(product.priceCents, 'pris', true) };
  const event = { id: operationId, type: 'product_added', at: timestamp(at), product: item };
  if (repeated(register, operationId, event)) return register;
  if (register.products.length >= 100) fail('För många produkter');
  validProduct(item, register.products);
  const next = copy(register);
  next.products.push(item);
  next.events.push(event);
  return next;
}

function updateCashProduct(register, productId, priceCents, operationId, at) {
  requireOpen(register);
  identifier(operationId, 'händelse-ID');
  const prior = register.events.find(event => event.id === operationId);
  if (prior) {
    if (prior.type === 'price_changed' && prior.productId === productId &&
        prior.newPriceCents === priceCents && prior.at === at) return register;
    fail('Händelse-ID har annat innehåll');
  }
  const product = register.products.find(item => item.id === productId);
  if (!product) fail('Varan finns inte');
  const newPriceCents = cents(priceCents, 'pris', true);
  const event = { id: operationId, type: 'price_changed', at: timestamp(at),
    productId, oldPriceCents: product.priceCents, newPriceCents };
  const next = copy(register);
  next.products.find(item => item.id === productId).priceCents = newPriceCents;
  next.events.push(event);
  return next;
}

function recordCashPurchase(register, input) {
  requireOpen(register);
  const id = identifier(input?.id, 'köp-ID');
  identifier(input.operationId, 'händelse-ID');
  if (!Array.isArray(input.lines) || !input.lines.length || input.lines.length > 100) {
    fail('Köpet saknar varor');
  }
  const ids = new Set();
  const lines = input.lines.map(line => {
    const product = register.products.find(item => item.id === line.productId);
    if (!product || ids.has(product.id)) fail('Ogiltig eller dubbel vara');
    ids.add(product.id);
    const quantity = cents(line.quantity, 'antal', true);
    if (quantity > 10000) fail('För stort antal');
    const amountCents = product.priceCents * quantity;
    cents(amountCents, 'radsumma', true);
    return { productId: product.id, name: product.name, priceCents: product.priceCents,
      quantity, amountCents };
  });
  const totalCents = lines.reduce((sum, line) => sum + line.amountCents, 0);
  cents(totalCents, 'köpsumma', true);
  if (!METHODS.has(input.method)) fail('Ogiltigt betalsätt');
  if (input.method === 'Swish' && input.swishEnabled !== true) {
    fail('Swish är inte aktiverat');
  }
  if (input.method === 'Swish' && input.qrAmountCents !== totalCents) {
    fail('Swishbeloppet stämmer inte med köpet');
  }
  const receivedCents = input.method === 'Kontant'
    ? cents(input.receivedCents, 'mottagna kontanter', true) : totalCents;
  if (receivedCents < totalCents) fail('Mottagna kontanter räcker inte');
  const purchase = { id, operationId: input.operationId, at: timestamp(input.at),
    method: input.method, lines, totalCents, receivedCents,
    changeCents: receivedCents - totalCents, void: null };
  const previous = register.purchases.find(item => item.id === id);
  if (previous) {
    if (JSON.stringify(previous) === JSON.stringify(purchase)) return register;
    fail('Köp-ID används redan med annat innehåll');
  }
  if (!requireUnused(register, input.operationId)) fail('Händelse-ID används redan');
  const next = append(register, { id: input.operationId, type: 'purchase_paid',
    at: purchase.at, purchaseId: id });
  next.purchases.push(purchase);
  return next;
}

function voidCashPurchase(register, input) {
  requireOpen(register);
  identifier(input?.operationId, 'händelse-ID');
  const purchase = register.purchases.find(item => item.id === input.purchaseId);
  if (purchase?.void?.operationId === input.operationId) {
    const prior = purchase.void;
    if (prior.at === input.at && prior.reason === input.reason?.trim() &&
        prior.paymentReceived === input.paymentReceived &&
        prior.refundMethod === (input.paymentReceived ? input.refundMethod : null)) return register;
    fail('Händelse-ID har annat innehåll');
  }
  if (!requireUnused(register, input.operationId)) fail('Händelse-ID används redan');
  if (!purchase || purchase.void) fail('Köpet kan inte makuleras');
  const paymentReceived = input.paymentReceived;
  if (typeof paymentReceived !== 'boolean') fail('Ange om betalningen togs emot');
  const refundMethod = paymentReceived ? input.refundMethod : null;
  if (paymentReceived && refundMethod !== 'Kontant') {
    fail('Återbetalning från kassan måste ske kontant');
  }
  if (paymentReceived && cashTotals(register).expectedCashCents < purchase.totalCents) {
    fail('Kassan saknar kontanter för återbetalningen');
  }
  if (!paymentReceived && input.refundMethod != null) fail('Ingen återbetalning ska göras');
  const voided = { operationId: input.operationId, at: timestamp(input.at),
    reason: string(input.reason, 'orsak', 300), paymentReceived,
    refundMethod, refundCents: paymentReceived ? purchase.totalCents : 0 };
  const next = append(register, { id: input.operationId, type: 'purchase_voided',
    at: voided.at, purchaseId: purchase.id });
  next.purchases.find(item => item.id === purchase.id).void = voided;
  return next;
}

function cashTotals(register) {
  let cashSalesCents = 0;
  let swishReceiptsCents = 0;
  let swishTransactionCount = 0;
  let cashRefundsCents = 0;
  const products = new Map();
  for (const purchase of register.purchases) {
    if (!purchase.void || purchase.void.paymentReceived) {
      if (purchase.method === 'Kontant') cashSalesCents += purchase.totalCents;
      else {
        swishReceiptsCents += purchase.totalCents;
        swishTransactionCount++;
      }
    }
    if (purchase.void?.refundMethod === 'Kontant') {
      cashRefundsCents += purchase.void.refundCents;
    }
    if (purchase.void) continue;
    for (const line of purchase.lines) {
      const key = `${line.productId}:${purchase.method}`;
      const current = products.get(key) || { productId: line.productId, name: line.name,
        method: purchase.method, quantity: 0, amountCents: 0 };
      current.quantity += line.quantity;
      current.amountCents += line.amountCents;
      products.set(key, current);
    }
  }
  return { openingFloatCents: register.openingFloatCents,
    cashSalesCents, swishReceiptsCents, swishTransactionCount, cashRefundsCents,
    expectedCashCents: register.openingFloatCents + cashSalesCents - cashRefundsCents,
    products: [...products.values()].sort((a, b) =>
      a.name.localeCompare(b.name, 'sv') || a.method.localeCompare(b.method, 'sv')) };
}

function closeCashRegister(register, input) {
  if (register?.close?.operationId === input?.operationId &&
      register.close.at === input.at &&
      register.close.closerMemberId === input.closerMemberId &&
      register.close.countedCashCents === input.countedCashCents) return register;
  requireOpen(register);
  if (!requireUnused(register, input?.operationId)) fail('Händelse-ID används redan');
  const countedCashCents = cents(input.countedCashCents, 'räknad kontantkassa');
  const memberId = identifier(input.closerMemberId, 'avslutarens medlemsnummer');
  const at = timestamp(input.at);
  const totals = cashTotals(register);
  const next = append(register, { id: input.operationId, type: 'closed', at });
  next.status = 'pending_sync';
  next.close = { operationId: input.operationId, at, closerMemberId: memberId, closerVerified: false,
    countedCashCents, cashDifferenceCents: countedCashCents - totals.expectedCashCents,
    sameAsOpener: memberId === register.ownerMemberId };
  return next;
}

function verifyCashCloser(register, closer, at) {
  if (register?.status !== 'pending_sync' || !register.close) fail('Kassan väntar inte på verifiering');
  if (closer?.memberId !== register.close.closerMemberId || closer?.board !== true) {
    fail('Avslutaren måste vara aktiv styrelsemedlem i EKO');
  }
  const next = copy(register);
  next.close.closerVerified = true;
  next.close.closerName = string(closer.name, 'avslutarens namn', 80);
  next.close.closerRole = string(closer.role, 'avslutarens roll', 40);
  next.close.verifiedAt = timestamp(at);
  return next;
}

function markCashSynced(register, at) {
  if (register?.status !== 'pending_sync' || !register.close?.closerVerified) {
    fail('Avslut och medlemsnummer måste vara verifierade');
  }
  const next = copy(register);
  next.status = 'pending_cashier';
  next.syncedAt = timestamp(at);
  return next;
}

function reviewCashRegister(register, input) {
  const operationId = identifier(input?.operationId, 'händelse-ID');
  if (register?.review?.operationId === operationId) {
    if (register.review.reviewerMemberId === input.reviewerMemberId &&
        register.review.bankSwishCents === input.bankSwishCents &&
        (!register.review.aborted || register.review.countedCashCents === input.countedCashCents) &&
        register.review.at === input.at) return register;
    fail('Händelse-ID har annat innehåll');
  }
  const aborted = register?.status === 'aborted_pending_review';
  if (register?.status !== 'pending_cashier' && !aborted) {
    fail('Kassan är inte redo för kassören');
  }
  if (input?.cashierRole !== 'Kassör' && input?.cashierRole !== 'Admin') {
    fail('Endast kassör eller administratör får granska');
  }
  const bankSwishCents = cents(input.bankSwishCents, 'kontrollerad Swishsumma');
  const totals = cashTotals(register);
  const at = timestamp(input.at);
  const countedCashCents = aborted
    ? cents(input.countedCashCents, 'räknade kontanter')
    : register.close.countedCashCents;
  const next = copy(register);
  next.review = { operationId, at,
    reviewerMemberId: identifier(input.reviewerMemberId, 'granskare'),
    bankSwishCents, expectedSwishCents: totals.swishReceiptsCents,
    countedCashCents, expectedCashCents: totals.expectedCashCents,
    cashDifferenceCents: countedCashCents - totals.expectedCashCents,
    swishDifferenceCents: bankSwishCents - totals.swishReceiptsCents,
    aborted, possiblyIncomplete: aborted && register.abort.deviceLost };
  next.status = !aborted && next.review.cashDifferenceCents === 0 &&
    next.review.swishDifferenceCents === 0 ? 'approved_for_posting' : 'manual_review';
  return next;
}

function markCashPosted(register, at) {
  if (register?.status !== 'approved_for_posting') fail('Kassan är inte godkänd för EKO');
  const next = copy(register);
  next.status = 'posted';
  next.posting = { at: timestamp(at), reference: register.id };
  return next;
}

function markCashManuallyBooked(register, input) {
  const operationId = identifier(input?.operationId, 'händelse-ID');
  if (register?.posting?.operationId === operationId) {
    if (register.posting.reviewerMemberId === input.reviewerMemberId &&
        register.posting.reference === input.voucher?.trim() &&
        register.posting.at === input.at) return register;
    fail('Händelse-ID har annat innehåll');
  }
  if (register?.status !== 'manual_review') fail('Kassan behöver inte manuell bokföring');
  if (input?.cashierRole !== 'Kassör' && input?.cashierRole !== 'Admin') {
    fail('Endast kassör eller administratör får bokföra manuellt');
  }
  const next = copy(register);
  next.status = 'manually_booked';
  next.posting = { operationId, at: timestamp(input.at),
    reference: string(input.voucher, 'verifikation', 80),
    reviewerMemberId: identifier(input.reviewerMemberId, 'granskare') };
  return next;
}

function abortCashRegister(register, input) {
  if (register?.abort?.operationId === input?.operationId &&
      register.abort.at === input.at && register.abort.actorMemberId === input.actorMemberId &&
      register.abort.reason === input.reason?.trim() &&
      register.abort.deviceLost === (input.deviceLost === true)) return register;
  requireOpen(register);
  if (!requireUnused(register, input?.operationId)) fail('Händelse-ID används redan');
  if (input.board !== true) fail('Endast styrelsen får avbryta');
  const at = timestamp(input.at);
  const next = append(register, { id: input.operationId, type: 'aborted', at });
  next.status = 'aborted_pending_review';
  next.abort = { operationId: input.operationId, at,
    actorMemberId: identifier(input.actorMemberId, 'styrelsemedlem'),
    reason: string(input.reason, 'orsak', 300),
    deviceLost: input.deviceLost === true, recoveredPurchases: register.purchases.length };
  return next;
}


// Kontantposter kan överföras efter avstämning. Varje Swishbetalning lämnas
// som en separat post för kassörens manuella bokföring i EKO.
// Appen beräknar aldrig Swishavgiften och skriver inga Swishrader i EKO.
function buildCashPostingPlan(register) {
  if (register?.status !== 'approved_for_posting' ||
      !register.close?.closerVerified || !register.review ||
      register.review.cashDifferenceCents !== 0 ||
      register.review.swishDifferenceCents !== 0) {
    throw new Error('Kassan är inte avstämd och godkänd');
  }
  const totals = cashTotals(register);
  const grouped = new Map();
  const swishForManual = [];
  function cashLine(type, line) {
    const key = JSON.stringify([type, line.productId, line.name]);
    const current = grouped.get(key) || {
      type, category: 'Försäljning', method: 'Kontant',
      productId: line.productId, product: line.name,
      quantity: 0, amountCents: 0,
    };
    current.quantity += line.quantity;
    current.amountCents += line.amountCents;
    grouped.set(key, current);
  }
  for (const purchase of register.purchases) {
    if (purchase.void && !purchase.void.paymentReceived) continue;
    if (purchase.method === 'Swish') {
      swishForManual.push({ purchaseId: purchase.id, date: register.accountingDate,
        amountCents: purchase.totalCents,
        reference: `${register.id}-SW-${purchase.id}`,
        description: purchase.lines.map(line =>
          `${line.name} ${line.quantity} st`).join(', '),
        refundedInCash: purchase.void?.refundMethod === 'Kontant' });
      if (purchase.void?.refundMethod === 'Kontant') {
        for (const line of purchase.lines) cashLine('Utgift', line);
      }
    } else {
      for (const line of purchase.lines) {
        cashLine('Inkomst', line);
        if (purchase.void?.refundMethod === 'Kontant') cashLine('Utgift', line);
      }
    }
  }
  const rows = [...grouped.values()].sort((a, b) =>
    a.type.localeCompare(b.type, 'sv') ||
    a.product.localeCompare(b.product, 'sv') ||
    a.productId.localeCompare(b.productId, 'sv'));
  rows.forEach((row, index) => {
    row.date = register.accountingDate;
    row.reference = `${register.id}-CASH-${String(index + 1).padStart(3, '0')}`;
    row.description = `${row.product} · ${row.quantity} st`;
  });
  const cashMovement = rows.reduce((sum, row) => sum +
    (row.type === 'Inkomst' ? 1 : -1) * row.amountCents, 0);
  const swishGross = swishForManual.reduce((sum, item) => sum + item.amountCents, 0);
  if (cashMovement !== totals.cashSalesCents - totals.cashRefundsCents ||
      swishGross !== totals.swishReceiptsCents ||
      swishForManual.length !== totals.swishTransactionCount) {
    throw new Error('Kassans betalningar och bokföringsunderlag stämmer inte');
  }
  return { cashId: register.id, associationId: register.associationId,
    date: register.accountingDate, rows, swishForManual,
    cashMovementCents: cashMovement, swishGrossCents: swishGross };
}

// Den framtida EKO-adaptern måste låsa läsning och skrivning tillsammans.
// Endast automatisk KONTANT-bokföring får använda denna funktion.
async function reconcileCashPosting(plan, adapter) {
  if (!plan?.cashId || !plan?.associationId || !Array.isArray(plan.rows) ||
      typeof adapter?.withLock !== 'function' ||
      typeof adapter?.findAutoCashRows !== 'function' ||
      typeof adapter?.append !== 'function') {
    throw new Error('Kontantunderlag och låst lagring krävs');
  }
  if (plan.rows.some(row => row.method !== 'Kontant' ||
      !row.reference.startsWith(`${plan.cashId}-CASH-`))) {
    throw new Error('Endast kontantposter får överföras automatiskt');
  }
  return adapter.withLock(plan.associationId, async () => {
    const existing = await adapter.findAutoCashRows(plan.cashId);
    if (!Array.isArray(existing)) throw new Error('EKO kunde inte läsas');
    const expected = new Map(plan.rows.map(row => [row.reference, row]));
    if (expected.size !== plan.rows.length) throw new Error('Dubbla verifikationer i planen');
    const seen = new Set();
    for (const row of existing) {
      const wanted = expected.get(row.reference);
      if (!wanted || seen.has(row.reference) ||
          JSON.stringify(row) !== JSON.stringify(wanted)) {
        throw new Error('EKO motsäger det godkända kontantunderlaget');
      }
      seen.add(row.reference);
    }
    for (const row of plan.rows) {
      if (seen.has(row.reference)) continue;
      await adapter.append(row);
    }
    return { added: plan.rows.length - seen.size, alreadyPresent: seen.size };
  });
}

// Swishs förifyllda QR-kod öppnar bara kundens betalningsformulär.
// Den bevisar inte att betalningen har genomförts.
function buildPrefilledQrRequest(cash, purchaseId, lines, payee) {
  if (cash?.status !== 'open' || !Array.isArray(cash.products)) {
    throw new Error('Kassan är inte öppen');
  }
  if (typeof payee !== 'string' || !/^\d{10,15}$/.test(payee)) {
    throw new Error('Föreningens Swishnummer saknas');
  }
  if (typeof purchaseId !== 'string' || !/^[A-Za-z0-9-]{8,36}$/.test(purchaseId)) {
    throw new Error('Ogiltigt köp-ID');
  }
  const reference = `${cash.id}-${purchaseId}`;
  if (reference.length > 50 || !/^[-A-Za-z0-9]+$/.test(reference)) {
    throw new Error('Köpreferensen är för lång');
  }
  if (!Array.isArray(lines) || !lines.length || lines.length > 100) {
    throw new Error('Köpet saknar varor');
  }
  const seen = new Set();
  let amountCents = 0;
  for (const line of lines) {
    const product = cash.products.find(item => item.id === line.productId);
    if (!product || seen.has(product.id) || !Number.isSafeInteger(line.quantity) ||
        line.quantity < 1 || line.quantity > 10000) throw new Error('Ogiltig vara');
    seen.add(product.id);
    amountCents += product.priceCents * line.quantity;
  }
  if (!Number.isSafeInteger(amountCents) || amountCents < 1 || amountCents > 100000000) {
    throw new Error('Ogiltigt köpbelopp');
  }
  return { amountCents, reference, payload: {
    format: 'png', size: 400,
    payee: { value: payee, editable: false },
    amount: { value: amountCents / 100, editable: false },
    message: { value: reference, editable: false }
  } };
}

return { openCashRegister, addCashProduct, updateCashProduct,
  recordCashPurchase, voidCashPurchase, cashTotals, closeCashRegister,
  verifyCashCloser, markCashSynced, reviewCashRegister, markCashPosted,
  markCashManuallyBooked, abortCashRegister, buildCashPostingPlan,
  buildPrefilledQrRequest };
})();
