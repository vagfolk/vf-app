import test from 'node:test';
import assert from 'node:assert/strict';
import { openCashRegister, recordCashPurchase, voidCashPurchase, closeCashRegister,
  verifyCashCloser, markCashSynced, reviewCashRegister } from '../src/cash-register.mjs';
import { buildCashPostingPlan, reconcileCashPosting } from '../src/cash-posting.mjs';

const at = '2026-10-21T10:00:00.000Z';
function register() {
  return openCashRegister({ id: 'K-2026-0042', associationId: 'vf-test',
    ownerMemberId: 'M-100', deviceId: 'dev-1', openedAt: at,
    accountingDate: '2026-10-21', openingFloatCents: 20000,
    products: [{ id: 'kaffe', name: 'Kaffe', priceCents: 2000 },
      { id: 'bulle', name: 'Bulle', priceCents: 1500 }] });
}
function pay(cash, id, method, lines) {
  const qrAmountCents = lines.reduce((sum, line) => sum +
    cash.products.find(product => product.id === line.productId).priceCents * line.quantity, 0);
  return recordCashPurchase(cash, { id, operationId: `op-${id}`, at,
    method, lines, receivedCents: 10000, swishEnabled: method === 'Swish',
    qrAmountCents });
}
function approve(cash, countedCashCents, bankSwishCents) {
  cash = closeCashRegister(cash, { operationId: 'close-1', at,
    closerMemberId: 'M-200', countedCashCents });
  cash = verifyCashCloser(cash,
    { memberId: 'M-200', name: 'Styrelse Person', role: 'Styrelse', board: true }, at);
  cash = markCashSynced(cash, at);
  return reviewCashRegister(cash, { at, cashierRole: 'Kassör', operationId: 'review-1',
    reviewerMemberId: 'M-300', bankSwishCents });
}

test('två Swishköp ger två separata underlag för kassörens manuella EKO-rader', () => {
  let cash = register();
  cash = pay(cash, 'kop-1', 'Swish', [{ productId: 'kaffe', quantity: 2 },
    { productId: 'bulle', quantity: 1 }]);
  cash = pay(cash, 'kop-2', 'Swish', [{ productId: 'kaffe', quantity: 1 }]);
  const plan = buildCashPostingPlan(approve(cash, 20000, 7500));
  assert.equal(plan.rows.length, 0);
  assert.equal(plan.swishForManual.length, 2);
  assert.deepEqual(plan.swishForManual.map(item => [item.purchaseId, item.amountCents,
    item.description]), [['kop-1', 5500, 'Kaffe 2 st, Bulle 1 st'],
      ['kop-2', 2000, 'Kaffe 1 st']]);
  assert.ok(plan.swishForManual.every(item => item.date === '2026-10-21'));
});

test('makulerat Swishköp behåller manuellt Swishunderlag och kontant utgift', () => {
  let cash = pay(register(), 'kop-1', 'Swish', [{ productId: 'kaffe', quantity: 1 }]);
  cash = voidCashPurchase(cash, { operationId: 'void-1', at, purchaseId: 'kop-1',
    paymentReceived: true, refundMethod: 'Kontant', reason: 'Felköp' });
  const plan = buildCashPostingPlan(approve(cash, 18000, 2000));
  assert.equal(plan.cashMovementCents, -2000);
  assert.equal(plan.swishGrossCents, 2000);
  assert.deepEqual(plan.rows.map(row => [row.type, row.method, row.amountCents]),
    [['Utgift', 'Kontant', 2000]]);
  assert.equal(plan.swishForManual[0].refundedInCash, true);
});

test('delvis EKO-skrivning kan återupptas utan dubbla rader', async () => {
  let cash = register();
  cash = pay(cash, 'kop-1', 'Kontant', [{ productId: 'kaffe', quantity: 1 }]);
  cash = pay(cash, 'kop-2', 'Kontant', [{ productId: 'bulle', quantity: 1 }]);
  const plan = buildCashPostingPlan(approve(cash, 23500, 0));
  const stored = [];
  let breakOnce = true;
  const adapter = {
    async withLock(_id, task) { return task(); },
    async findAutoCashRows(id) { return stored.filter(row => row.reference.startsWith(id + '-CASH-')); },
    async append(row) {
      stored.push(structuredClone(row));
      if (breakOnce) { breakOnce = false; throw new Error('Avbrott efter skrivning'); }
    },
  };
  await assert.rejects(reconcileCashPosting(plan, adapter), /Avbrott/);
  assert.deepEqual(await reconcileCashPosting(plan, adapter), { added: 1, alreadyPresent: 1 });
  assert.deepEqual(await reconcileCashPosting(plan, adapter), { added: 0, alreadyPresent: 2 });
  assert.equal(stored.length, 2);
  stored[0].amountCents += 1;
  await assert.rejects(reconcileCashPosting(plan, adapter), /motsäger/);
});

test('avvikelse kan inte ge bokföringsplan', () => {
  let cash = pay(register(), 'kop-1', 'Kontant', [{ productId: 'kaffe', quantity: 1 }]);
  const reviewed = approve(cash, 21000, 0);
  assert.equal(reviewed.status, 'manual_review');
  assert.throws(() => buildCashPostingPlan(reviewed), /inte avstämd/);
});
