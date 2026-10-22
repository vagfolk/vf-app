import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { openCashRegister, recordCashPurchase, closeCashRegister,
  verifyCashCloser, markCashSynced, reviewCashRegister } from '../src/cash-register.mjs';
import { buildCashPostingPlan } from '../src/cash-posting.mjs';

const source = readFileSync(new URL('../experiments/apps-script-private-sheet-read/data/CashEko.gs',
  import.meta.url), 'utf8');
const at = '2026-10-21T10:00:00.000Z';
function approved() {
  let cash = openCashRegister({ id:'K-2026-0042', associationId:'vf-test',
    ownerMemberId:'M-100', deviceId:'dev-1', openedAt:at,
    accountingDate:'2026-10-21', openingFloatCents:10000,
    products:[{ id:'coffee', name:'Kaffe', priceCents:2000 }] });
  cash = recordCashPurchase(cash, { id:'purchase-cash', operationId:'op-cash', at,
    method:'Kontant', receivedCents:2000, lines:[{ productId:'coffee', quantity:1 }] });
  cash = recordCashPurchase(cash, { id:'purchase-swish', operationId:'op-swish', at,
    method:'Swish', swishEnabled:true, qrAmountCents:2000,
    lines:[{ productId:'coffee', quantity:1 }] });
  cash = closeCashRegister(cash, { operationId:'close-1', at,
    closerMemberId:'M-200', countedCashCents:12000 });
  cash = verifyCashCloser(cash,
    { memberId:'M-200', name:'Styrelse Person', role:'Styrelse', board:true }, at);
  cash = markCashSynced(cash, at);
  return reviewCashRegister(cash, { operationId:'review-1', at,
    cashierRole:'Kassör', reviewerMemberId:'M-300', bankSwishCents:2000 });
}
function fixture(cash) {
  const plan = buildCashPostingPlan(cash);
  const rows = [];
  let writes = 0;
  let failAfterWrite = false;
  const header = ['Datum', 'Typ', 'Kategori', 'Betalsätt', 'Beskrivning',
    'Belopp', 'Kvitto-/fakturanr', 'Kontroll', 'Giltig'];
  const context = { VFCashCore:{ buildCashPostingPlan },
    ScriptApp:{ getOAuthToken:() => 'fake-token' },
    readRange_:(_id, range) => {
      if (range.includes('A11:I11')) return [header];
      if (range.includes('D27:E48')) return [['Försäljning', 'Ja']];
      if (range.includes('B10:B11')) return [[46023], [46387]];
      if (range.includes('A12:I2011')) return rows;
      throw Error(`Unexpected range: ${range}`);
    },
    sheetsRequest_:(_url, method, payload) => {
      assert.equal(method, 'post');
      assert.equal(payload.valueInputOption, 'RAW');
      for (const item of payload.data) {
        const number = Number(item.range.match(/!A(\d+):/)[1]);
        rows[number - 12] = [...item.values[0], '', 1];
        writes++;
        if (failAfterWrite) { failAfterWrite = false; throw Error('connection_lost'); }
      }
      return {};
    }
  };
  runInNewContext(source, context);
  return { context, rows, plan, get writes() { return writes; },
    failNextWrite() { failAfterWrite = true; } };
}

test('appen skriver bara kontanter; Swish kräver en manuell rad per betalning', () => {
  const cash = approved();
  const f = fixture(cash);
  assert.equal(f.context.cashEkoWriteCash_('sheet-id', cash, 'vf-test').cashRows, 1);
  assert.equal(f.writes, 1);
  assert.equal(f.rows[0][3], 'Kontant');
  assert.equal(f.rows[0][6], f.plan.rows[0].reference);
  assert.equal(f.context.cashEkoWriteCash_('sheet-id', cash, 'vf-test').cashRows, 1);
  assert.equal(f.writes, 1);
  cash.cashPosting = { at };
  assert.throws(() => f.context.cashEkoVerifyManualSwish_('sheet-id', cash, 'vf-test'),
    /cash_swish_not_booked/);
  const payment = f.plan.swishForManual[0];
  f.rows[1] = [f.context.cashEkoDateSerial_(payment.date), 'Inkomst', 'Försäljning',
    'Swish', payment.description, payment.amountCents / 100, payment.reference, '', 1];
  assert.equal(f.context.cashEkoVerifyManualSwish_('sheet-id', cash, 'vf-test')
    .verifiedSwish, 1);
  f.rows[1][5] = 5;
  assert.throws(() => f.context.cashEkoVerifyManualSwish_('sheet-id', cash, 'vf-test'),
    /cash_swish_eko_conflict/);
});

test('avbrott efter EKO-skrivning kan återupptas utan dubbel post', () => {
  const cash = approved();
  const f = fixture(cash);
  f.failNextWrite();
  assert.throws(() => f.context.cashEkoWriteCash_('sheet-id', cash, 'vf-test'),
    /connection_lost/);
  assert.equal(f.rows.length, 1);
  f.context.cashEkoWriteCash_('sheet-id', cash, 'vf-test');
  assert.equal(f.writes, 1);
  f.rows[0][5] = 500;
  assert.throws(() => f.context.cashEkoWriteCash_('sheet-id', cash, 'vf-test'),
    /cash_eko_conflict/);
});

test('fel förening eller ej godkänd kassa kan inte bokföras', () => {
  const cash = approved();
  const f = fixture(cash);
  assert.throws(() => f.context.cashEkoWriteCash_('sheet-id', cash, 'other'),
    /cash_not_approved/);
  cash.status = 'manual_review';
  assert.throws(() => f.context.cashEkoWriteCash_('sheet-id', cash, 'vf-test'),
    /cash_not_approved/);
  assert.equal(f.writes, 0);
});

test('fel räkenskapsperiod stoppas innan någon EKO-rad skrivs', () => {
  const cash = approved();
  cash.accountingDate = '2027-01-01';
  const f = fixture(cash);
  assert.throws(() => f.context.cashEkoWriteCash_('sheet-id', cash, 'vf-test'),
    /cash_eko_period_mismatch/);
  assert.equal(f.writes, 0);
});
