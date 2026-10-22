import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const base = new URL('../experiments/apps-script-private-sheet-read/data/', import.meta.url);
function row(id, role, name) {
  const cells = Array(21).fill('');
  cells[1] = name; cells[16] = id; cells[18] = role; cells[20] = 'Aktiv';
  return cells;
}
function fixture() {
  const associationId = 'VF-TEST-2026';
  const files = new Map();
  const values = new Map([
    ['VF_APP_ROOT_FOLDER_ID', 'app-root-folder-000000000001'],
    ['VF_TEST_CASH_SWISH_ENABLED', 'false'],
  ]);
  let serial = 0;
  const eko = { posts:0, verifies:0 };
  const context = {
    APP_ROOT_FOLDER_PROPERTY: 'VF_APP_ROOT_FOLDER_ID',
    reply_: (allowed, reason, data) => ({ allowed, reason, data }),
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    ScriptApp: { getOAuthToken: () => 'fake-token' },
    Utilities: {
      formatDate: date => date.toISOString().slice(0, 10),
      newBlob: value => ({ getBytes: () => Array.from(Buffer.from(value, 'utf8')) }),
    },
    driveRequest_: (url, method, payload) => {
      if (method === 'post') return { id: 'cash-folder-000000000000001' };
      if (method === 'get' && url.includes('/drive/v3/files?')) {
        return { files: [...files].map(([id, item]) => ({ id, name: item.name })) };
      }
      throw Error('Unexpected Drive request');
    },
    saveContactFile_: (_folder, name, _mime, bytes, existingId) => {
      const id = existingId || `cash-file-${String(++serial).padStart(20, '0')}`;
      files.set(id, { name, body: Buffer.from(bytes).toString('utf8') });
      return id;
    },
    UrlFetchApp: { fetch: url => {
      const id = decodeURIComponent(url.split('/files/')[1].split('?')[0]);
      const file = files.get(id);
      return { getResponseCode: () => file ? 200 : 404,
        getContentText: () => file?.body || '' };
    } },
    cashEkoWriteCash_: (_sheet, cash, id) => {
      assert.equal(id, associationId); assert.equal(cash.status, 'approved_for_posting');
      eko.posts++; return { cashRows:1, swishToBook:0 };
    },
    cashEkoVerifyManualSwish_: () => { eko.verifies++; return { verifiedSwish:0 }; },
  };
  runInNewContext(readFileSync(new URL('CashCore.gs', base), 'utf8'), context);
  runInNewContext(readFileSync(new URL('Cash.gs', base), 'utf8'), context);
  const props = { getProperty: key => values.get(key) || null,
    setProperty: (key, value) => values.set(key, value) };
  const opener = row('M-OPEN', 'Styrelse', 'Öppnare');
  const colleague = row('M-CLOSE', 'Styrelse', 'Avslutare');
  const cashier = row('M-CASHIER', 'Kassör', 'Kassör');
  const members = [[], opener, colleague, cashier];
  const handle = (action, input, user = opener) => context.cashHandle_(action,
    input == null ? undefined : JSON.stringify(input), user,
    [user[18]], members, associationId, props, 'sheet-id');
  return { handle, opener, colleague, cashier, files, values, eko };
}

test('öppning är unik per användare och enhet, även vid upprepat anrop', () => {
  const f = fixture();
  const input = { requestId:'open-request-001', deviceId:'device-0001',
    openingFloatCents:10000, products:[{ id:'coffee', name:'Kaffe', priceCents:2000 }] };
  const first = f.handle('cash_open', input);
  assert.equal(first.allowed, true);
  assert.match(first.data.cash.id, /^K-\d{4}-0001$/);
  const overview = f.handle('cash_list');
  assert.equal(overview.data.viewerMemberId, 'M-OPEN');
  assert.equal(overview.data.products[0].name, 'Kaffe');
  assert.equal(f.handle('cash_open', input).data.cash.id, first.data.cash.id);
  assert.equal(f.handle('cash_open', { ...input, requestId:'open-request-002' }).reason,
    'cash_already_open');
  assert.equal(f.handle('cash_open', { ...input, requestId:'open-request-003' }, f.colleague).reason,
    'cash_already_open');
  const another = f.handle('cash_open', { ...input, requestId:'open-request-004',
    deviceId:'device-0002' }, f.colleague);
  assert.equal(another.allowed, true);
  assert.notEqual(another.data.cash.id, first.data.cash.id);
});

test('bara öppnaren på rätt enhet säljer; kassör granskar efter verifierat avslut', () => {
  const f = fixture();
  const opened = f.handle('cash_open', { requestId:'open-request-001',
    deviceId:'device-0001', openingFloatCents:10000,
    products:[{ id:'coffee', name:'Kaffe', priceCents:2000 }] });
  const cashId = opened.data.cash.id;
  const buy = { cashId, deviceId:'device-0001', event:{ kind:'purchase',
    id:'purchase-001', operationId:'operation-001', at:'2026-10-21T10:00:00.000Z',
    method:'Kontant', receivedCents:2000,
    lines:[{ productId:'coffee', quantity:1 }] } };
  assert.equal(f.handle('cash_event', buy, f.colleague).reason, 'cash_wrong_owner_or_device');
  assert.equal(f.handle('cash_event', { ...buy, deviceId:'device-0002' }).reason,
    'cash_wrong_owner_or_device');
  assert.equal(f.handle('cash_event', buy).allowed, true);
  assert.equal(f.handle('cash_event', buy).data.cash.purchases.length, 1);
  const close = { cashId, deviceId:'device-0001', event:{ kind:'close',
    operationId:'operation-close', at:'2026-10-21T10:20:00.000Z',
    expectedEventCount:1, countedCashCents:12000, closerMemberId:'M-CLOSE' } };
  assert.equal(f.handle('cash_event', close).allowed, true);
  assert.equal(f.handle('cash_event', close).data.cash.status, 'pending_cashier');
  const review = { cashId, operationId:'review-001', bankSwishCents:0 };
  assert.equal(f.handle('cash_review', review, f.colleague).reason, 'insufficient_role');
  const approved = f.handle('cash_review', review, f.cashier);
  assert.equal(approved.data.cash.status, 'posted');
  assert.equal(f.handle('cash_review', review, f.cashier).data.cash.status,
    'posted');
  assert.equal(f.handle('cash_event', buy).allowed, false);
});

test('avbruten kassa kan inte godkännas automatiskt även när summan stämmer', () => {
  const f = fixture();
  const opened = f.handle('cash_open', { requestId:'open-request-001',
    deviceId:'device-0001', openingFloatCents:10000, products:[] });
  const cashId = opened.data.cash.id;
  const aborted = f.handle('cash_abort', { cashId,
    operationId:'abort-operation-001', reason:'Trasig enhet', deviceLost:true }, f.colleague);
  assert.equal(aborted.data.cash.status, 'aborted_pending_review');
  const review = f.handle('cash_review', { cashId, operationId:'review-001',
    countedCashCents:10000, bankSwishCents:0 }, f.cashier);
  assert.equal(review.data.cash.status, 'manual_review');
  assert.equal(review.data.cash.review.possiblyIncomplete, true);
});

test('osynkade köp återvinns efter avbrott men går alltid till manuell granskning', () => {
  const f = fixture();
  const opened = f.handle('cash_open', { requestId:'open-request-001',
    deviceId:'device-0001', openingFloatCents:10000,
    products:[{ id:'coffee', name:'Kaffe', priceCents:2000 }] });
  const cashId = opened.data.cash.id;
  f.handle('cash_abort', { cashId, operationId:'abort-operation-001',
    reason:'Enheten svarade inte', deviceLost:false }, f.colleague);
  const recovered = f.handle('cash_event', { cashId, deviceId:'device-0001',
    event:{ kind:'purchase', id:'purchase-offline', operationId:'event-offline',
      at:'2026-10-21T10:00:00.000Z', method:'Kontant', receivedCents:2000,
      lines:[{ productId:'coffee', quantity:1 }] } });
  assert.equal(recovered.allowed, true);
  assert.equal(recovered.data.cash.status, 'aborted_pending_review');
  assert.equal(recovered.data.cash.abort.recoveredPurchases, 1);
  assert.equal(f.handle('cash_review', { cashId, operationId:'review-001',
    countedCashCents:12000, bankSwishCents:0 }, f.cashier).reason,
    'cash_recovery_pending');
  assert.equal(f.handle('cash_recovery_done', { cashId,
    deviceId:'device-0001' }).data.cash.abort.recoveryMemberId, 'M-OPEN');
  const review = f.handle('cash_review', { cashId, operationId:'review-001',
    countedCashCents:12000, bankSwishCents:0 }, f.cashier);
  assert.equal(review.data.cash.status, 'manual_review');
  assert.equal(f.eko.posts, 0);
});

test('kassörens godkännande överför kontanter direkt och upprepat anrop bokför inte igen', () => {
  const f = fixture();
  const opened = f.handle('cash_open', { requestId:'open-request-001',
    deviceId:'device-0001', openingFloatCents:10000,
    products:[{ id:'coffee', name:'Kaffe', priceCents:2000 }] });
  const cashId = opened.data.cash.id;
  assert.equal(f.handle('cash_post', { cashId }, f.cashier).allowed, false);
  f.handle('cash_event', { cashId, deviceId:'device-0001', event:{ kind:'purchase',
    id:'purchase-001', operationId:'operation-001', at:'2026-10-21T10:00:00.000Z',
    method:'Kontant', receivedCents:2000,
    lines:[{ productId:'coffee', quantity:1 }] } });
  f.handle('cash_event', { cashId, deviceId:'device-0001', event:{ kind:'close',
    operationId:'operation-close', at:'2026-10-21T10:20:00.000Z',
    expectedEventCount:1, countedCashCents:12000, closerMemberId:'M-CLOSE' } });
  f.handle('cash_review', { cashId, operationId:'review-001', bankSwishCents:0 }, f.cashier);
  assert.equal(f.handle('cash_post', { cashId }, f.colleague).reason, 'insufficient_role');
  assert.equal(f.handle('cash_get', { cashId }, f.cashier).data.cash.status, 'posted');
  assert.equal(f.handle('cash_post', { cashId }, f.cashier).data.replay, true);
  assert.equal(f.eko.posts, 1);
});

test('styrelsen kan markera förlorad enhet så att kassören utreder manuellt', () => {
  const f = fixture();
  const opened = f.handle('cash_open', { requestId:'open-request-001',
    deviceId:'device-0001', openingFloatCents:10000, products:[] });
  const cashId = opened.data.cash.id;
  f.handle('cash_abort', { cashId, operationId:'abort-operation-001',
    reason:'Enheten svarar inte', deviceLost:false }, f.colleague);
  const lost = f.handle('cash_mark_lost', { cashId,
    reason:'Enheten kan inte återfås' }, f.colleague);
  assert.equal(lost.data.cash.abort.deviceLost, true);
  const reviewed = f.handle('cash_review', { cashId, operationId:'review-001',
    countedCashCents:10000, bankSwishCents:0 }, f.cashier);
  assert.equal(reviewed.data.cash.status, 'manual_review');
  assert.equal(f.eko.posts, 0);
});
