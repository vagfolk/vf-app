import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const nonce = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const parentSource = readFileSync(new URL('../experiments/apps-script-private-sheet-read/identity/CashParent.html', import.meta.url), 'utf8')
  .match(/<script>([\s\S]*?)<\/script>/)?.[1];
const clientSource = readFileSync(new URL('../public/offline-cash/test-client.js', import.meta.url), 'utf8');
if (!parentSource) throw Error('Kassafönstrets koppling saknas');

function parentFixture(permission) {
  let click;
  let message;
  let calls = 0;
  const forwarded = [];
  const sent = [];
  const popup = { postMessage(value, origin) { sent.push({ value, origin }); } };
  const status = { textContent:'' };
  const window = {
    open:() => popup,
    addEventListener:(_type, callback) => { message = callback; },
  };
  const document = { getElementById:id => id === 'status'
    ? status : { addEventListener:(_type, callback) => { click = callback; } } };
  const run = { withSuccessHandler(success) { return {
    withFailureHandler() { return {
      readDashboardData(action) {
        assert.equal(action, 'profile'); calls++;
        success({ allowed:true, data:{ name:'Privat namn',
          permissions:permission ? ['sales_manage'] : ['own_fee'] } });
      },
      cashRequest(action, input) {
        forwarded.push({ action, input });
        success({ allowed:true, data:{ cashes:[] } });
      },
    }; },
  }; } };
  runInNewContext(parentSource, { window, document, google:{ script:{ run } } });
  click();
  return { popup, status, sent, forwarded, calls:() => calls,
    send(origin, source = popup, token = nonce) {
      message({ origin, source, data:{ type:'vf-cash-parent-ready', nonce:token } });
    },
    request(origin, source = popup, action = 'cash_list') {
      message({ origin, source, data:{ type:'vf-cash-parent-request', nonce,
        requestId:'11111111-2222-4333-8444-555555555555', action, input:null } });
    } };
}

test('Google-fönstret svarar bara sitt eget GitHub-fönster och skickar inga profiluppgifter', () => {
  for (const permission of [true, false]) {
    const fixture = parentFixture(permission);
    fixture.send('https://annan.example');
    fixture.send('https://vagfolk.github.io', {});
    fixture.send('https://vagfolk.github.io', fixture.popup, 'fel');
    assert.equal(fixture.calls(), 0);
    fixture.send('https://vagfolk.github.io');
    assert.equal(fixture.calls(), 1);
    assert.equal(fixture.sent[0].origin, 'https://vagfolk.github.io');
    assert.equal(fixture.sent[0].value.allowed, permission);
    assert.equal(JSON.stringify(fixture.sent).includes('Privat namn'), false);
  }
});

test('GitHub-sidan kräver svar från det öppnande Google-fönstret och rätt engångskod', () => {
  let message;
  const status = { textContent:'' };
  const sent = [];
  const opener = { postMessage:(value, origin) => sent.push({ value, origin }) };
  const window = {
    opener,
    addEventListener:(type, callback) => { if (type === 'message') message = callback; },
  };
  runInNewContext(clientSource, { window, document:{ getElementById:() => status },
    location:{ href:'https://vagfolk.github.io/vf-app/public/offline-cash/?bridge=parent' },
    navigator:{ onLine:true }, crypto:{ randomUUID:() => nonce }, URL,
    setTimeout:() => 1, clearTimeout:() => {} });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].value.type, 'vf-cash-parent-ready');
  assert.equal(sent[0].value.nonce, nonce);
  message({ source:{}, origin:'https://script.google.com',
    data:{ type:'vf-cash-parent-result', nonce, allowed:true } });
  message({ source:opener, origin:'https://annan.example',
    data:{ type:'vf-cash-parent-result', nonce, allowed:true } });
  message({ source:opener, origin:'https://script.google.com',
    data:{ type:'vf-cash-parent-result', nonce:'fel', allowed:true } });
  assert.equal(status.textContent, 'Kontrollerar behörighet via den inloggade appen…');
  message({ source:opener, origin:'https://script.google.com',
    data:{ type:'vf-cash-parent-result', nonce, allowed:false } });
  assert.equal(status.textContent, 'Ingen åtkomst till kassan.');
});

test('Kassaåtgärder går bara via godkänt fönster och Google kontrollerar varje anrop', () => {
  const denied = parentFixture(false);
  denied.send('https://vagfolk.github.io');
  denied.request('https://vagfolk.github.io');
  assert.equal(denied.forwarded.length, 0);

  const allowed = parentFixture(true);
  allowed.send('https://vagfolk.github.io');
  allowed.request('https://annan.example');
  allowed.request('https://vagfolk.github.io', {});
  allowed.request('https://vagfolk.github.io', allowed.popup, 'annan_action');
  assert.equal(allowed.forwarded.length, 0);
  allowed.request('https://vagfolk.github.io');
  assert.deepEqual(allowed.forwarded, [{ action:'cash_list', input:null }]);
  assert.equal(allowed.sent.at(-1).origin, 'https://vagfolk.github.io');
  assert.equal(allowed.sent.at(-1).value.type, 'vf-cash-parent-response');
});
