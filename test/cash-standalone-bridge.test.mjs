import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../public/cash/bridge.js', import.meta.url), 'utf8');
const nonce = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const requestId = '11111111-2222-4333-8444-555555555555';
const googleOrigin = 'https://n-eg65gknbhcukip5zkxrgs36zciqpzzcekdwdgbq-0lu-script.googleusercontent.com';

function fixture() {
  const sent = [];
  const opener = { closed:false, postMessage:(value, origin) => sent.push({ value, origin }) };
  const status = { textContent:'', hidden:false };
  const classes = [];
  let message;
  let id = 0;
  const window = { opener, addEventListener:(type, callback) => {
    if (type === 'message') message = callback;
  } };
  const document = { getElementById:() => status,
    documentElement:{ classList:{ add:value => classes.push(value) } } };
  runInNewContext(source, { window, document, navigator:{ onLine:true },
    crypto:{ randomUUID:() => id++ ? requestId : nonce }, URL,
    setTimeout:() => 1, clearTimeout:() => {} });
  return { window, opener, sent, status, classes,
    deliver(value, origin = googleOrigin, sourceWindow = opener) {
      message({ data:value, origin, source:sourceWindow });
    } };
}

test('Fristående kassa visar inget innehåll före godkänt svar och binder sina anrop till öppnaren', async () => {
  const f = fixture();
  assert.equal(f.sent[0].value.type, 'vf-cash-parent-ready');
  assert.equal(f.classes.length, 0);
  f.deliver({ type:'vf-cash-parent-result', nonce, allowed:true },
    'https://annan.example');
  f.deliver({ type:'vf-cash-parent-result', nonce, allowed:true },
    googleOrigin, {});
  assert.equal(f.classes.length, 0);
  f.deliver({ type:'vf-cash-parent-result', nonce, allowed:true });
  assert.deepEqual(f.classes, ['authorized']);
  const result = f.window.VFCashBridge.request('cash_list', null);
  await Promise.resolve();
  assert.equal(f.sent[1].value.action, 'cash_list');
  assert.equal(f.sent[1].origin, googleOrigin);
  f.deliver({ type:'vf-cash-parent-response', nonce, requestId,
    result:{ allowed:true, data:{ cashes:[] } } }, 'https://annan.example');
  assert.equal(f.sent.length, 2);
  f.deliver({ type:'vf-cash-parent-response', nonce, requestId,
    result:{ allowed:true, data:{ cashes:[] } } });
  assert.equal((await result).allowed, true);
});
