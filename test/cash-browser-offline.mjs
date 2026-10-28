import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const core = read('../experiments/apps-script-private-sheet-read/data/CashCore.gs');
const assets = {
  'index.html': read('../public/cash/index.html'),
  'bridge.js': read('../public/cash/bridge.js'),
  'sw.js': read('../public/cash/sw.js'),
};
const googleOrigin = 'https://n-eg65gknbhcukip5zkxrgs36zciqpzzcekdwdgbq-0lu-script.googleusercontent.com';
const parentHtml = `<!doctype html><html><meta charset="utf-8">
<button id="open" onclick="window.open('https://vagfolk.github.io/vf-app/public/cash/','cash')">Öppna kassa</button>
<script>${core}</script><script>
window.__server = { cash:null, eventCalls:0, canReview:false, postings:0 };
window.addEventListener('message', event => {
  if (event.origin !== 'https://vagfolk.github.io') return;
  const data = event.data;
  if (data?.type === 'vf-cash-parent-ready') {
    event.source.postMessage({ type:'vf-cash-parent-result', nonce:data.nonce, allowed:true }, event.origin);
    return;
  }
  if (data?.type !== 'vf-cash-parent-request') return;
  const server = window.__server;
  let result;
  try {
    if (data.action === 'cash_list') result = { cashes:server.cash ? [{
      id:server.cash.id, ownerName:'TESTPERSON', ownerMemberId:'M-OPEN',
      accountingDate:server.cash.accountingDate, status:server.cash.status
    }] : [], viewerMemberId:'M-OPEN', canReview:server.canReview,
      swishEnabled:false, products:[] };
    else if (data.action === 'cash_open') {
      const date = new Date().toISOString().slice(0,10);
      server.cash = VFCashCore.openCashRegister({
        id:'K-' + date.slice(0,4) + '-9001', associationId:'VF-TEST-2026',
        ownerMemberId:'M-OPEN', deviceId:data.input.deviceId,
        openedAt:new Date().toISOString(), accountingDate:date,
        openingFloatCents:data.input.openingFloatCents, products:data.input.products
      });
      result = { cash:server.cash };
    } else if (data.action === 'cash_event') {
      server.eventCalls++;
      if (data.input.event.kind === 'close') {
        const closed = VFCashCore.closeCashRegister(server.cash, data.input.event);
        const verified = VFCashCore.verifyCashCloser(closed,
          { memberId:'M-OPEN', name:'TESTPERSON', role:'Styrelse', board:true },
          new Date().toISOString());
        server.cash = VFCashCore.markCashSynced(verified, new Date().toISOString());
      } else {
        server.cash = VFCashCore.recordCashPurchase(server.cash,
          { ...data.input.event, swishEnabled:false });
      }
      result = { cash:server.cash };
    } else if (data.action === 'cash_get') result = { cash:server.cash };
    else if (data.action === 'cash_review') {
      if (!server.canReview) throw Error('insufficient_role');
      server.cash = VFCashCore.reviewCashRegister(server.cash, {
        ...data.input, cashierRole:'Kassör', reviewerMemberId:'M-CASHIER',
        at:new Date().toISOString()
      });
      result = { cash:server.cash };
    } else if (data.action === 'cash_post') {
      if (!server.canReview) throw Error('insufficient_role');
      const plan = VFCashCore.buildCashPostingPlan(server.cash);
      server.postings++;
      if (plan.swishForManual.length) throw Error('Unexpected Swish payment');
      server.cash = VFCashCore.markCashPosted(server.cash, new Date().toISOString());
      result = { cash:server.cash };
    }
    else throw Error('Unexpected action ' + data.action);
    event.source.postMessage({ type:'vf-cash-parent-response', nonce:data.nonce,
      requestId:data.requestId, result:{ allowed:true, data:result } }, event.origin);
  } catch (error) {
    event.source.postMessage({ type:'vf-cash-parent-response', nonce:data.nonce,
      requestId:data.requestId, result:{ allowed:false, reason:error.message } }, event.origin);
  }
});
</script></html>`;

const browser = await chromium.launch({
  executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless:true,
});
try {
  const context = await browser.newContext({ serviceWorkers:'allow' });
  await context.route(googleOrigin + '/vf-cash-test', route =>
    route.fulfill({ status:200, contentType:'text/html; charset=utf-8', body:parentHtml }));
  await context.route('https://vagfolk.github.io/vf-app/public/cash/**', route => {
    const suffix = new URL(route.request().url()).pathname.split('/public/cash/')[1];
    const file = suffix || 'index.html';
    const body = assets[file];
    if (!body) return route.fulfill({ status:404, body:'Not found' });
    return route.fulfill({ status:200, contentType:file.endsWith('.js')
      ? 'text/javascript; charset=utf-8' : 'text/html; charset=utf-8', body });
  });
  const parent = await context.newPage();
  await parent.goto(googleOrigin + '/vf-cash-test');
  const popupPromise = parent.waitForEvent('popup');
  await parent.getByRole('button', { name:'Öppna kassa' }).click();
  const cash = await popupPromise;
  cash.on('dialog', dialog => dialog.accept());
  await cash.getByText('Kassan är klar att användas.').waitFor();
  await cash.getByRole('button', { name:'Min kassa' }).click();
  await cash.getByRole('spinbutton', { name:'Växelkassa, totalsumma i kronor' }).fill('100');
  await cash.getByRole('combobox', { name:'Vara' }).fill('Testkaffe');
  await cash.getByRole('spinbutton', { name:'Pris i kronor' }).fill('10');
  await cash.getByRole('button', { name:'Lägg till vara' }).click();
  await cash.getByText('Testkaffe är tillagd i den nya kassan.').waitFor();
  await cash.getByRole('combobox', { name:'Vara' }).fill('Provvara');
  await cash.getByRole('spinbutton', { name:'Pris i kronor' }).fill('1');
  await cash.getByRole('button', { name:'Starta och godkänn kassa' }).click();
  await cash.getByText('Kassan är öppen.').waitFor();
  assert.deepEqual(await parent.evaluate(() => window.__server.cash.products.map(p => p.name)),
    ['Testkaffe', 'Provvara']);
  await context.setOffline(true);
  await cash.getByRole('button', { name:'+' }).first().click();
  await cash.getByRole('button', { name:'Betalt kontant' }).click();
  await cash.getByText(/Väntar på synk · 1 händelser/).waitFor();
  assert.equal(await parent.evaluate(() => window.__server.eventCalls), 0);
  await context.setOffline(false);
  await cash.getByText('Synkad', { exact:true }).waitFor();
  assert.equal(await parent.evaluate(() => window.__server.eventCalls), 1);
  assert.equal(await parent.evaluate(() => window.__server.cash.purchases.length), 1);
  assert.equal(await cash.locator('section.panel strong').filter({ hasText:/[a-f0-9]{8}-/ }).count(), 0);
  await context.setOffline(true);
  await cash.getByRole('spinbutton', { name:'Räknade kontanter vid avslut, kronor' }).fill('110');
  await cash.getByRole('textbox', { name:'Avslutarens medlemsnummer' }).fill('M-OPEN');
  await cash.getByRole('button', { name:'Avsluta kassa' }).click();
  await cash.getByText(/Väntar på synk · 1 händelser/).waitFor();
  await cash.getByText('Avslut sparat lokalt. Väntar på synk och kontroll.').waitFor();
  assert.equal(await parent.evaluate(() => window.__server.eventCalls), 1);
  await context.setOffline(false);
  await cash.getByText('Synkad · väntar på kassörens granskning').waitFor();
  assert.equal(await parent.evaluate(() => window.__server.eventCalls), 2);
  assert.equal(await parent.evaluate(() => window.__server.cash.status), 'pending_cashier');
  assert.equal(await parent.evaluate(() => window.__server.cash.purchases.length), 1);
  assert.equal(await cash.getByRole('button', { name:'Granskning' }).isVisible(), false);
  await parent.evaluate(() => { window.__server.canReview = true; });
  await cash.reload();
  await cash.getByRole('button', { name:'Granskning' }).click();
  await cash.getByRole('button', { name:'Granska' }).click();
  await cash.getByRole('spinbutton', {
    name:'Kontrollerad mottagen Swishsumma från banken, kronor'
  }).fill('0');
  await cash.getByRole('button', { name:'Granska och godkänn' }).click();
  await cash.getByText('Kontantförsäljning till EKO').waitFor();
  assert.equal(await parent.evaluate(() => window.__server.cash.status), 'approved_for_posting');
  await cash.getByRole('button', { name:'För över kontantposter' }).click();
  await cash.getByText('Kontantposterna är kontrollerade mot EKO.').waitFor();
  assert.equal(await parent.evaluate(() => window.__server.postings), 1);
  console.log('Browser offline purchase, close, review and posting: PASS');
} finally {
  await browser.close();
}
