import test from 'node:test';
import assert from 'node:assert/strict';
import {
  openCashRegister, addCashProduct, updateCashProduct, recordCashPurchase, voidCashPurchase,
  cashTotals, closeCashRegister, verifyCashCloser, markCashSynced,
  reviewCashRegister, markCashPosted, markCashManuallyBooked, abortCashRegister,
} from '../src/cash-register.mjs';

const at = '2026-10-21T10:00:00.000Z';
function opened() {
  return openCashRegister({ id: 'K-2026-0042', associationId: 'vf-test',
    ownerMemberId: 'M-100', deviceId: 'device-1', openedAt: at,
    accountingDate: '2026-10-21', openingFloatCents: 20000,
    products: [{ id: 'kaffe', name: 'Kaffe', priceCents: 2000 },
      { id: 'bulle', name: 'Bulle', priceCents: 1500 }] });
}
function paid(register, { id = 'kop-1', operationId = 'op-1', method = 'Kontant',
  lines = [{ productId: 'kaffe', quantity: 1 }, { productId: 'bulle', quantity: 2 }],
  receivedCents = 5000, swishEnabled = false } = {}) {
  const qrAmountCents = lines.reduce((sum, line) => sum +
    register.products.find(product => product.id === line.productId).priceCents * line.quantity, 0);
  return recordCashPurchase(register, { id, operationId, at, method, lines,
    receivedCents, swishEnabled, qrAmountCents });
}
function closed(register, countedCashCents) {
  return closeCashRegister(register, { operationId: 'close-1', at,
    closerMemberId: 'M-200', countedCashCents });
}
function ready(register) {
  return markCashSynced(verifyCashCloser(register,
    { memberId: 'M-200', name: 'Styrelse Person', role: 'Styrelse', board: true }, at), at);
}

test('varuköp sparar prisögonblick, antal, växel och kontantsumma', () => {
  const original = opened();
  let register = paid(original);
  assert.equal(original.purchases.length, 0);
  assert.equal(register.purchases[0].totalCents, 5000);
  assert.equal(register.purchases[0].changeCents, 0);
  assert.equal(cashTotals(register).expectedCashCents, 25000);
  register = addCashProduct(register,
    { id: 'dricka', name: 'Dricka', priceCents: 2500 }, 'add-1', at);
  assert.equal(register.products.length, 3);
  assert.equal(register.purchases[0].lines[0].priceCents, 2000);
  assert.deepEqual(cashTotals(register).products.map(item => item.quantity), [2, 1]);
});

test('upprepat köp-ID med samma operation skapar inte dubbla köp', () => {
  const register = paid(opened());
  assert.equal(paid(register), register);
  assert.throws(() => paid(register, { operationId: 'another' }), /Köp-ID/);
  assert.throws(() => paid(register, { receivedCents: 6000 }), /annat innehåll/);
  assert.equal(register.purchases.length, 1);
});

test('ändrat varupris gäller nya köp och lämnar tidigare köp orört', () => {
  const first = paid(opened());
  const changed = updateCashProduct(first, 'kaffe', 2500, 'price-1', at);
  const second = paid(changed, { id: 'kop-2', operationId: 'op-2', receivedCents: 5500 });
  assert.equal(second.purchases[0].lines[0].priceCents, 2000);
  assert.equal(second.purchases[1].lines[0].priceCents, 2500);
  assert.equal(cashTotals(second).expectedCashCents, 30500);
  assert.equal(updateCashProduct(changed, 'kaffe', 2500, 'price-1', at), changed);
  assert.throws(() => updateCashProduct(changed, 'kaffe', 3000, 'price-1', at), /annat innehåll/);
});

test('Swish kräver aktivering och räknas som uppgiven, separat bankkontroll', () => {
  assert.throws(() => paid(opened(), { method: 'Swish' }), /inte aktiverat/);
  assert.throws(() => recordCashPurchase(opened(), { id:'kop-1', operationId:'op-1',
    at, method:'Swish', swishEnabled:true, qrAmountCents:1,
    lines:[{ productId:'kaffe', quantity:1 }] }), /stämmer inte/);
  const register = paid(opened(), { method: 'Swish', swishEnabled: true });
  assert.equal(cashTotals(register).swishReceiptsCents, 5000);
  assert.equal(cashTotals(register).expectedCashCents, 20000);
});

test('mottagen Swish kan makuleras med kontant återbetalning och spårbar logg', () => {
  const register = paid(opened(), { method: 'Swish', swishEnabled: true });
  const voided = voidCashPurchase(register, { operationId: 'void-1', at,
    purchaseId: 'kop-1', paymentReceived: true,
    refundMethod: 'Kontant', reason: 'Kunden ångrade sig' });
  assert.equal(cashTotals(voided).swishReceiptsCents, 5000);
  assert.equal(cashTotals(voided).cashRefundsCents, 5000);
  assert.equal(cashTotals(voided).expectedCashCents, 15000);
  assert.deepEqual(cashTotals(voided).products, []);
  assert.equal(voided.events.at(-1).type, 'purchase_voided');
  assert.throws(() => voidCashPurchase(voided, { operationId: 'void-2', at,
    purchaseId: 'kop-1', paymentReceived: true,
    refundMethod: 'Kontant', reason: 'igen' }), /kan inte makuleras/);
});

test('ej mottagen betalning ger varken intäkt eller återbetalning', () => {
  const register = paid(opened());
  const voided = voidCashPurchase(register, { operationId: 'void-1', at,
    purchaseId: 'kop-1', paymentReceived: false, reason: 'Feltryck' });
  assert.equal(cashTotals(voided).cashSalesCents, 0);
  assert.equal(cashTotals(voided).expectedCashCents, 20000);
  assert.throws(() => voidCashPurchase(register, { operationId: 'void-2', at,
    purchaseId: 'kop-1', paymentReceived: true,
    refundMethod: 'Swish', reason: 'Fel' }), /kontant/);
});

test('avslut låser köp; kassörsgodkännande kräver verifierad avslutare och avstämning', () => {
  let register = closed(paid(opened()), 25000);
  assert.equal(register.close.sameAsOpener, false);
  assert.equal(register.accountingDate, '2026-10-21');
  assert.throws(() => paid(register, { id: 'kop-2', operationId: 'op-2' }), /inte öppen/);
  assert.throws(() => markCashSynced(register, at), /verifierade/);
  assert.throws(() => verifyCashCloser(register,
    { memberId: 'M-200', name: 'Fel', role: 'Medlem', board: false }, at), /styrelse/);
  register = ready(register);
  assert.throws(() => reviewCashRegister(register, { cashierRole: 'Styrelse',
    operationId: 'review-1', reviewerMemberId: 'M-300', bankSwishCents: 0, at }), /kassör/);
  register = reviewCashRegister(register, { cashierRole: 'Kassör', operationId: 'review-1',
    reviewerMemberId: 'M-300', bankSwishCents: 0, at });
  assert.equal(register.status, 'approved_for_posting');
  assert.equal(markCashPosted(register, at).status, 'posted');
});

test('kontantavvikelse och Swishavvikelse kräver manuell verifikation', () => {
  const paidSwish = paid(opened(), { method: 'Swish', swishEnabled: true });
  for (const [counted, bank] of [[19000, 5000], [20000, 4000]]) {
    const register = reviewCashRegister(ready(closed(paidSwish, counted)), {
      cashierRole: 'Kassör', operationId: 'review-1', reviewerMemberId: 'M-300',
      bankSwishCents: bank, at });
    assert.equal(register.status, 'manual_review');
    assert.throws(() => markCashPosted(register, at), /inte godkänd/);
    assert.equal(markCashManuallyBooked(register, { cashierRole: 'Kassör',
      operationId: 'manual-1',
      reviewerMemberId: 'M-300', voucher: 'V-2026-21', at }).status, 'manually_booked');
  }
});

test('annan styrelsemedlem kan avbryta; kassa-ID och befintliga köp sparas', () => {
  const register = paid(opened());
  assert.throws(() => abortCashRegister(register, { operationId: 'abort-1', at,
    actorMemberId: 'M-200', reason: 'Trasig enhet', board: false }), /styrelsen/);
  const aborted = abortCashRegister(register, { operationId: 'abort-1', at,
    actorMemberId: 'M-200', reason: 'Trasig enhet', board: true, deviceLost: true });
  assert.equal(aborted.id, 'K-2026-0042');
  assert.equal(aborted.abort.recoveredPurchases, 1);
  assert.equal(aborted.status, 'aborted_pending_review');
  assert.throws(() => paid(aborted, { id: 'kop-2', operationId: 'op-2' }), /inte öppen/);
});

test('även en tom avbruten kassa kräver kassörens granskning', () => {
  const aborted = abortCashRegister(opened(), { operationId: 'abort-1', at,
    actorMemberId: 'M-100', reason: 'Fel tillfälle', board: true });
  assert.equal(aborted.status, 'aborted_pending_review');
  assert.equal(abortCashRegister(aborted, { operationId: 'abort-1', at,
    actorMemberId: 'M-100', reason: 'Fel tillfälle', board: true }), aborted);
  const reviewed = reviewCashRegister(aborted, { operationId:'review-1', at,
    cashierRole:'Kassör', reviewerMemberId:'M-300', countedCashCents:20000,
    bankSwishCents:0 });
  assert.equal(reviewed.status, 'manual_review');
  assert.equal(reviewed.review.aborted, true);
});

test('växelkassa och produktbelopp avvisar decimaler, negativa belopp och ogiltigt år', () => {
  assert.throws(() => openCashRegister({ ...opened(), id: 'K-2025-0042' }), /öppningsår/);
  assert.throws(() => openCashRegister({ ...opened(), openingFloatCents: 12.5 }), /växelkassa/);
  assert.throws(() => addCashProduct(opened(), { id: 'xxx', name: 'X', priceCents: -1 }, 'add-1', at), /pris/);
});
