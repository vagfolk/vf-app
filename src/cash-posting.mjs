import { cashTotals } from './cash-register.mjs';

// Kontantposter kan överföras efter avstämning. Varje Swishbetalning lämnas
// som en separat post för kassörens manuella bokföring i EKO.
// Appen beräknar aldrig Swishavgiften och skriver inga Swishrader i EKO.
export function buildCashPostingPlan(register) {
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
export async function reconcileCashPosting(plan, adapter) {
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
