import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { webcrypto } from 'node:crypto';

const root = new URL('../experiments/apps-script-private-sheet-read/', import.meta.url);
const core = readFileSync(new URL('data/CashCore.gs', root), 'utf8');
const client = readFileSync(new URL('identity/CashClient.js', root), 'utf8')
  .replace('  start();\n})();',
    '  store = globalThis.__store; globalThis.__cashTest = { state, remember, appendEvent, sync };\n})();');
if (!client.includes('globalThis.__cashTest =')) throw Error('Kassaklienten kan inte provas');

function element() {
  return { classList:{ toggle() {} }, append() {}, replaceChildren() {},
    addEventListener() {}, setAttribute() {}, textContent:'', hidden:false };
}
function fixture() {
  const saved = new Map();
  const calls = [];
  const timers = new Map();
  let failWrite = false;
  let loseResponse = false;
  let timerNumber = 0;
  const navigator = { onLine:true };
  const server = { cash:null };
  const reply = async (action, input) => {
    calls.push(action);
    if (action === 'cash_event') {
      const recovering = server.cash.status === 'aborted_pending_review';
      if (recovering) server.cash.status = 'open';
      const event = input.event;
      if (event.kind !== 'purchase') throw Error('Oväntad händelse');
      server.cash = context.VFCashCore.recordCashPurchase(server.cash,
        { ...event, swishEnabled:false });
      if (recovering) server.cash.status = 'aborted_pending_review';
      if (loseResponse) { loseResponse = false; throw Error('Svaret försvann'); }
      return { allowed:true, data:{ cash:server.cash } };
    }
    if (action === 'cash_list') return { allowed:true, data:{
      cashes:[{ id:server.cash.id, status:server.cash.status }],
      viewerMemberId:'M-OPEN', canReview:false, swishEnabled:false, products:[]
    } };
    if (action === 'cash_recovery_done') {
      server.cash.abort.recoveryCompleteAt = '2026-10-22T12:00:00.000Z';
      return { allowed:true, data:{ cash:server.cash } };
    }
    throw Error(`Oväntat anrop: ${action}`);
  };
  const context = {
    navigator, crypto:webcrypto, console,
    document:{ hidden:false, getElementById:() => element(),
      querySelectorAll:() => [], querySelector:() => element(), createElement:element,
      addEventListener() {} },
    window:{ addEventListener() {} },
    google:{ script:{ run:{
      withSuccessHandler(success) { return {
        withFailureHandler(failure) { return {
          cashRequest(action, input) {
            reply(action, input).then(success, failure);
          }
        }; }
      }; }
    } } },
    localStorage:{ getItem:() => 'device-0001' },
    setTimeout(fn) { const id = ++timerNumber; timers.set(id, fn); return id; },
    clearTimeout(id) { timers.delete(id); },
    __store:async (method, value) => {
      if (failWrite) throw Error('Lokal lagring misslyckades');
      if (method === 'put') saved.set(value.id, structuredClone(value));
      return value;
    },
  };
  context.window.google = context.google;
  runInNewContext(core, context);
  runInNewContext(client, context);
  const cash = context.VFCashCore.openCashRegister({
    id:'K-2026-0001', associationId:'VF-TEST-2026', ownerMemberId:'M-OPEN',
    deviceId:'device-0001', openedAt:'2026-10-22T10:00:00.000Z',
    accountingDate:'2026-10-22', openingFloatCents:10000,
    products:[{ id:'coffee', name:'Kaffe', priceCents:1000 }],
  });
  server.cash = structuredClone(cash);
  return { api:context.__cashTest, core:context.VFCashCore, cash, server,
    saved, calls, timers, navigator,
    failWrites(value) { failWrite = value; },
    loseNextResponse() { loseResponse = true; } };
}

const purchase = id => ({ kind:'purchase', id, method:'Kontant',
  receivedCents:1000, lines:[{ productId:'coffee', quantity:1 }] });

test('köpet syns inte som sparat när den lokala transaktionen misslyckas', async () => {
  const f = fixture();
  await f.api.remember({ id:f.cash.id, cash:f.cash, queue:[] });
  f.failWrites(true);
  await assert.rejects(f.api.appendEvent(purchase('purchase-0001')),
    /Lokal lagring misslyckades/);
  assert.equal(f.api.state.cash.purchases.length, 0);
  assert.equal(f.saved.get(f.cash.id).queue.length, 0);
  assert.equal(f.calls.length, 0);
});

test('offlinekö ligger kvar lokalt, synkas efter återanslutning och tål förlorat svar', async () => {
  const f = fixture();
  await f.api.remember({ id:f.cash.id, cash:f.cash, queue:[] });
  f.navigator.onLine = false;
  await f.api.appendEvent(purchase('purchase-0001'));
  assert.equal(f.saved.get(f.cash.id).queue.length, 1);
  assert.equal(f.calls.length, 0);
  f.navigator.onLine = true;
  f.loseNextResponse();
  await f.api.sync();
  assert.equal(f.server.cash.purchases.length, 1);
  assert.equal(f.saved.get(f.cash.id).queue.length, 1);
  assert.equal(f.timers.size, 1);
  const [retryId, fireRetry] = [...f.timers.entries()][0];
  f.timers.delete(retryId); // setTimeout är en engångstimer i webbläsaren.
  fireRetry();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.server.cash.purchases.length, 1);
  assert.equal(f.saved.get(f.cash.id).queue.length, 0);
  assert.equal(f.timers.size, 0);
});

test('avbruten kassa återhämtar osynkat köp före kassörens granskning', async () => {
  const f = fixture();
  await f.api.remember({ id:f.cash.id, cash:f.cash, queue:[] });
  f.navigator.onLine = false;
  await f.api.appendEvent(purchase('purchase-0001'));
  f.server.cash = f.core.abortCashRegister(f.server.cash, {
    operationId:'abort-0001', at:'2026-10-22T11:00:00.000Z',
    actorMemberId:'M-BOARD', board:true, reason:'Enheten slutade svara', deviceLost:false,
  });
  f.navigator.onLine = true;
  await f.api.sync();
  assert.equal(f.server.cash.purchases.length, 1);
  assert.ok(f.server.cash.abort.recoveryCompleteAt);
  assert.equal(f.saved.get(f.cash.id).queue.length, 0);
  assert.equal(f.api.state.cash.status, 'aborted_pending_review');
});
