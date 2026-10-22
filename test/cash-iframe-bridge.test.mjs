import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const nonce = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const source = readFileSync(new URL('../experiments/apps-script-private-sheet-read/identity/CashBridge.html', import.meta.url), 'utf8')
  .match(/<script>([\s\S]*?)<\/script>/)?.[1]
  .replace('__VF_BRIDGE_NONCE__', nonce);
if (!source) throw Error('Kopplingsskriptet saknas');

function fixture(permission = true) {
  let listener;
  let calls = 0;
  const messages = [];
  const parent = { postMessage: (value, origin) => messages.push({ value, origin }) };
  const win = {
    top: parent,
    addEventListener: (_type, fn) => { listener = fn; },
  };
  const run = {
    withSuccessHandler(success) { return {
      withFailureHandler() { return {
        readDashboardData(action) {
          assert.equal(action, 'profile'); calls++;
          success({ allowed:true, data:{ name:'Skyddat namn',
            permissions:permission ? ['sales_manage'] : ['own_fee'] } });
        },
      }; },
    }; },
  };
  runInNewContext(source, { window:win,
    document:{ getElementById:() => ({ textContent:'' }) },
    google:{ script:{ run } } });
  return { parent, messages, send(origin, value, sender = parent) {
    listener({ origin, data:value, source:sender });
  }, calls:() => calls };
}

test('okänd sida eller fel kopplingskod får ingen behörighetskontroll', () => {
  const f = fixture();
  f.send('https://annan.example', { type:'vf-cash-bridge-check', nonce });
  f.send('https://vagfolk.github.io', { type:'vf-cash-bridge-check', nonce:'fel' });
  f.send('https://vagfolk.github.io', { type:'vf-cash-bridge-check', nonce }, {});
  assert.equal(f.calls(), 0);
  assert.equal(f.messages.length, 1); // Endast startmeddelandet, utan personuppgifter.
});

test('godkänd sida får endast kassabehörighet, aldrig profiluppgifter', () => {
  for (const permission of [true, false]) {
    const f = fixture(permission);
    f.send('https://vagfolk.github.io', { type:'vf-cash-bridge-check', nonce });
    assert.equal(f.calls(), 1);
    assert.equal(f.messages[1].origin, 'https://vagfolk.github.io');
    assert.equal(f.messages[1].value.allowed, permission);
    assert.equal(JSON.stringify(f.messages).includes('Skyddat namn'), false);
  }
});

test('okänt konto får kassakopplingen före profilkontrollen, utan data i HTML', () => {
  const code = readFileSync(new URL('../experiments/apps-script-private-sheet-read/identity/Code.gs', import.meta.url), 'utf8');
  let profileCalls = 0;
  const context = {
    ScriptApp: { AuthMode:{ FULL:'full' }, requireAllScopes() {},
      getService:() => ({ getUrl:() => 'https://script.google.com/test' }) },
    HtmlService: {
      XFrameOptionsMode:{ ALLOWALL:'allowall' },
      createHtmlOutputFromFile:() => ({ getContent:() => '<p>__VF_BRIDGE_NONCE__</p>' }),
      createHtmlOutput:html => ({ html,
        setXFrameOptionsMode() { return this; }, setTitle() { return this; } }),
    },
  };
  runInNewContext(code, context);
  context.readDashboardData = () => { profileCalls++; return { allowed:false }; };
  const response = context.doGet({ parameter:{ view:'cash_bridge', nonce } });
  assert.equal(profileCalls, 0);
  assert.equal(response.html, `<p>${nonce}</p>`);
});
