import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../public/offline-cash/sw.js', import.meta.url), 'utf8');

async function offlineNavigation(scopeUrl, targetUrl) {
  const listeners = new Map();
  const store = new Map();
  let networkCalls = 0;
  const scope = new URL(scopeUrl);
  const key = value => new URL(value.url || value, scope).href;
  const cache = {
    addAll: async assets => assets.forEach(asset =>
      store.set(key(asset), { asset })),
  };
  const caches = {
    open: async () => cache,
    keys: async () => [],
    delete: async () => true,
    match: async request => store.get(key(request)),
  };
  const self = {
    location: { origin: scope.origin },
    registration: { scope: scopeUrl },
    clients: { claim: async () => {} },
    skipWaiting: async () => {},
    addEventListener: (name, callback) => listeners.set(name, callback),
  };
  runInNewContext(source, { self, caches, URL,
    fetch: async () => { networkCalls++; throw Error('offline'); } });
  let install;
  listeners.get('install')({ waitUntil: promise => { install = promise; } });
  await install;
  let response;
  listeners.get('fetch')({ request: { url: targetUrl, method:'GET', mode:'navigate' },
    respondWith: promise => { response = promise; } });
  return { response: response && await response, networkCalls };
}

test('GitHub-skalet öppnas från cachen utan nät efter installation', async () => {
  const base = 'https://vagfolk.github.io/vf-app/public/offline-cash/';
  const result = await offlineNavigation(base, base + 'index.html?fran-ikon=1');
  assert.equal(result.response.asset, './index.html');
  assert.equal(result.networkCalls, 1);
});

test('samma offlinekod fungerar även i lokal testsökväg', async () => {
  const base = 'http://127.0.0.1:3187/';
  const result = await offlineNavigation(base, base);
  assert.equal(result.response.asset, './');
  assert.equal(result.networkCalls, 0);
});
