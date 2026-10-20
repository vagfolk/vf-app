import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const code = readFileSync(new URL('../experiments/apps-script-private-sheet-read/identity/Code.gs', import.meta.url), 'utf8');

function app() {
  const calls = [];
  const context = {
    ScriptApp: {
      AuthMode: { FULL: 'full' },
      requireAllScopes: mode => calls.push(['scope', mode]),
      getService: () => ({ getUrl: () => 'https://script.google.com/macros/s/test/exec' }),
    },
    HtmlService: {
      createHtmlOutput: html => ({ html, setTitle(title) { this.title = title; return this; } }),
    },
  };
  runInNewContext(code, context);
  context.readTestData_ = request => {
    calls.push(['data', request.action]);
    return { allowed: true };
  };
  context.readDashboardData = action => {
    calls.push(['profile', action]);
    throw new Error('Profilen ska inte läsas vid utloggning');
  };
  return { doGet: context.doGet, calls };
}

test('utloggning avslutar appnärvaro före inloggningssidan', () => {
  const { doGet, calls } = app();
  const page = doGet({ parameter: { view: 'logout' } });
  assert.deepEqual(calls.filter(([kind]) => kind === 'data'), [['data', 'leave_app']]);
  assert.equal(calls.some(([kind]) => kind === 'profile'), false);
  assert.match(page.html, /Appen är stängd/);
  assert.match(page.html, /Google-kontot är fortfarande inloggat/);
  assert.match(page.html, /Välj Google-konto/);
});

test('inloggningssidan avslutar inte appnärvaro', () => {
  const { doGet, calls } = app();
  const page = doGet({ parameter: { view: 'login' } });
  assert.equal(calls.some(([kind]) => kind === 'data'), false);
  assert.match(page.html, /Välkommen till Vägfölk/);
});
