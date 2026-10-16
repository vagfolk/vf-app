import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

test('växling mellan Start och Kalender hämtar inte om oförändrad profil och kalender', async () => {
  const listeners = new Map();
  const calls = [];
  const responses = {
    profile: { permissions: ['own_fee', 'board_view'], name: 'Anna' },
    own_fee: { memberId: 'M1', name: 'Anna' },
    calendar: { events: [], links: {} },
    information: { message: null },
    chat: { messages: [] },
  };
  const document = {
    hidden: false,
    addEventListener(type, callback) {
      const callbacks = listeners.get(type) || [];
      callbacks.push(callback);
      listeners.set(type, callbacks);
    },
    dispatchEvent(event) {
      for (const callback of listeners.get(event.type) || []) callback(event);
    },
    querySelector() { return { textContent: '' }; },
  };
  const run = {
    withSuccessHandler(success) {
      return {
        withFailureHandler() {
          return new Proxy({}, {
            get(_target, name) {
              return (action) => {
                calls.push(action || String(name));
                queueMicrotask(() => success({ allowed: true, data: responses[action] }));
              };
            },
          });
        },
      };
    },
  };
  const window = { google: { script: { run } }, VFDashboard: { setData() {}, refresh() {} } };
  runInNewContext(readFileSync(new URL('../experiments/apps-script-private-sheet-read/identity/DashboardClient.js', import.meta.url), 'utf8'),
    { window, document, google: window.google, setInterval() {}, CustomEvent: class {
      constructor(type, options) { this.type = type; this.detail = options.detail; }
    } });

  document.dispatchEvent({ type: 'vf:dashboard-ready' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls.filter(action => action === 'profile').length, 1);
  assert.equal(calls.filter(action => action === 'calendar').length, 1);

  document.dispatchEvent({ type: 'vf:view-selected', detail: { id: 'kalender' } });
  document.dispatchEvent({ type: 'vf:view-selected', detail: { id: 'start' } });
  document.dispatchEvent({ type: 'visibilitychange' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls.filter(action => action === 'profile').length, 1);
  assert.equal(calls.filter(action => action === 'calendar').length, 1);
});
