import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

test('EKO-läsning startar under filmen och visas först när alla svar finns', async () => {
  const listeners = new Map();
  const calls = [];
  const shown = [];
  let finishProfile;
  const responses = {
    profile: { permissions: ['own_fee', 'board_view'], name: 'Anna' },
    own_fee: { memberId: 'M1', name: 'Anna' },
    board_summary: { result: 1 },
    calendar: { events: [], links: {} },
    information: { message: null },
    chat: { messages: [] },
    tasks: { tasks: [] },
    contacts: { contacts: [] },
    documents: { documents: [] },
    app_versions: { eko: 'e1', store: 's1', calendar: {}, online: 1 },
  };
  const document = {
    addEventListener(type, callback) {
      const callbacks = listeners.get(type) || [];
      callbacks.push(callback);
      listeners.set(type, callbacks);
    },
    querySelector() { return { textContent: '' }; },
  };
  const run = {
    withSuccessHandler(success) {
      return { withFailureHandler() {
        return { readDashboardData(action) {
          calls.push(action);
          if (action === 'profile') finishProfile = () => success({ allowed: true, data: responses.profile });
          else queueMicrotask(() => success({ allowed: true, data: responses[action] }));
        } };
      } };
    },
  };
  const window = { google: { script: { run } }, VFDashboard: {
    startStartup() { calls.push('film'); },
    setData(data) { shown.push({ connection: data.connection, user: data.user }); },
  } };
  runInNewContext(readFileSync(new URL('../experiments/apps-script-private-sheet-read/identity/DashboardClient.js', import.meta.url), 'utf8'),
    { window, document, google: window.google, setInterval() {}, CustomEvent: class {} });

  for (const callback of listeners.get('vf:dashboard-ready')) callback();
  assert.equal(calls[0], 'film');
  await new Promise(resolve => setImmediate(resolve));
  for (const action of ['profile', 'own_fee', 'calendar', 'information', 'chat',
    'tasks', 'contacts', 'documents', 'app_versions']) assert.ok(calls.includes(action));
  assert.equal(shown.length, 0);
  finishProfile();
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(calls.includes('board_summary'));
  assert.equal(shown.at(-1).connection, 'google_test');
  assert.equal(shown.at(-1).user.name, 'Anna');
});

test('växling mellan Start och Kalender hämtar inte om oförändrad profil och kalender', async () => {
  const listeners = new Map();
  const calls = [];
  const snapshots = [];
  const onlineCounts = [];
  const responses = {
    profile: { permissions: ['own_fee', 'board_view'], name: 'Anna' },
    own_fee: { memberId: 'M1', name: 'Anna' },
    board_summary: { result: 0 },
    calendar: { events: [], links: {}, version: { member: 'v1' } },
    app_versions: { eko: 'e1', store: 's1', calendar: { member: 'v1' } },
    information: { message: null },
    chat: { messages: [] },
    tasks: { tasks: [] },
    contacts: { contacts: [] },
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
                queueMicrotask(() => success(name === 'authorizeDashboardView'
                  ? responses.authorizeDashboardView
                  : responses[action]?.allowed === false
                    ? responses[action] : { allowed: true, data: responses[action] }));
              };
            },
          });
        },
      };
    },
  };
  const window = { google: { script: { run } }, VFDashboard: {
    setData(data) { snapshots.push({ user: data.user, connection: data.connection,
      calendar: data.calendar, tasks: data.tasks }); },
    setOnlineCount(count) { onlineCounts.push(count); }, refresh() {} } };
  runInNewContext(readFileSync(new URL('../experiments/apps-script-private-sheet-read/identity/DashboardClient.js', import.meta.url), 'utf8'),
    { window, document, google: window.google, setInterval() {}, CustomEvent: class {
      constructor(type, options) { this.type = type; this.detail = options.detail; }
    } });

  document.dispatchEvent({ type: 'vf:dashboard-ready' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls.filter(action => action === 'profile').length, 1);
  assert.equal(calls.filter(action => action === 'calendar').length, 1);
  const renderCount = snapshots.length;

  responses.authorizeDashboardView = { allowed: false, reason: 'data_unavailable' };
  assert.equal(await window.VFDashboard.authorizeView('board'), false);
  assert.equal(snapshots.at(-1).connection, 'google_test');
  assert.equal(snapshots.at(-1).user.name, 'Anna');

  document.dispatchEvent({ type: 'vf:view-selected', detail: { id: 'kalender' } });
  document.dispatchEvent({ type: 'vf:view-selected', detail: { id: 'start' } });
  document.dispatchEvent({ type: 'visibilitychange' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls.filter(action => action === 'profile').length, 1);
  assert.equal(calls.filter(action => action === 'calendar').length, 1);
  assert.equal(calls.filter(action => action === 'app_versions').length, 2);
  assert.equal(snapshots.length, renderCount);
  assert.equal(onlineCounts.length, 1);

  responses.app_versions = { eko: 'e1', store: 's1', calendar: { member: 'v2' } };
  responses.calendar = { events: [], links: {}, version: { member: 'v2' } };
  document.dispatchEvent({ type: 'visibilitychange' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls.filter(action => action === 'calendar').length, 2);
  assert.equal(calls.filter(action => action === 'profile').length, 1);

  responses.app_versions = { eko: 'e1', store: 's2', calendar: { member: 'v2' } };
  document.dispatchEvent({ type: 'visibilitychange' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls.filter(action => action === 'tasks').length, 2);
  assert.equal(calls.filter(action => action === 'contacts').length, 1);
  assert.equal(calls.filter(action => action === 'calendar').length, 2);

  responses.app_versions = { allowed: false, reason: 'data_unavailable' };
  document.dispatchEvent({ type: 'visibilitychange' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(snapshots.at(-1).connection, 'google_test');
  assert.equal(snapshots.at(-1).user.name, 'Anna');
  assert.equal(snapshots.at(-1).calendar.version.member, 'v2');
});
