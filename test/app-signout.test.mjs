import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const code = readFileSync(new URL('../experiments/apps-script-private-sheet-read/identity/Code.gs', import.meta.url), 'utf8');
const dashboard = readFileSync(new URL('../experiments/apps-script-private-sheet-read/identity/Dashboard.html', import.meta.url), 'utf8');

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

test('medlemmens Start visar Logga ut utan styrelsereglage', () => {
  const section = dashboard.match(/  const signoutControl = options => \{[\s\S]*?\n  const renderCalendar =/);
  assert.ok(section);
  const context = {
    element: (tag, className, text) => ({ tag, className, text, children: [], append(...items) { this.children.push(...items); } }),
    heading: text => ({ tag: 'heading', text }),
    button: text => ({ tag: 'button', text }),
  };
  runInNewContext(section[0].replace(/\n  const renderCalendar =$/, '') + '\nthis.renderStart = renderStart;', context);
  const root = { children: [], append(...items) { this.children.push(...items); } };
  context.renderStart(root, {
    connection: 'google_test', name: 'Testmedlem',
    user: { permissions: ['own_fee'] },
  });
  assert.equal(root.children.length, 1);
  const [header] = root.children;
  assert.equal(header.children[1].text, 'Logga ut');
  assert.equal(header.children[1].href, '__VF_LOGOUT_URL__');
  assert.equal(header.children[1].target, '_top');
});

test('medlemmens Start får visas i mittdisplayen efter inloggning', () => {
  const section = dashboard.match(/    function updateScreenContentVisibility\(\) \{[\s\S]*?\n    \}/);
  assert.ok(section);
  const context = {
    activeLayoutView: 'interactive',
    selectedMenu: 'start',
    selectedCard: null,
    screenContent: { hidden: true },
    document: { body: { classList: { contains: () => true } } },
    window: { VFAppData: { user: { permissions: ['own_fee'] } } },
  };
  runInNewContext(section[0] + '\nthis.updateScreenContentVisibility = updateScreenContentVisibility;', context);
  context.updateScreenContentVisibility();
  assert.equal(context.screenContent.hidden, false);
});
