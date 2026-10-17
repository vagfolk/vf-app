import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

function node(tag = 'div') {
  return {
    tag, children: [], textContent: '', dataset: {},
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = children; },
    setAttribute() {},
    addEventListener() {},
  };
}

function textOf(current) {
  return [current.textContent, ...current.children.map(textOf)].join(' ');
}

test('Start visar inga medlemskort före inloggning eller för styrelseroll', () => {
  const window = {};
  const document = {
    createElement: node,
    createDocumentFragment: () => node('fragment'),
    addEventListener() {},
  };
  runInNewContext(readFileSync(new URL('../public/dashboard-views.js', import.meta.url), 'utf8'),
    { window, document, Date, Intl, Set });
  const display = node('main');
  display.id = 'screen-content';
  window.VFPreviewViews.attach(display);

  window.VFPreviewViews.show('start', { connection: 'checking' });
  assert.doesNotMatch(textOf(display), /Öppna kalender|Öppna information/);

  window.VFPreviewViews.show('start', {
    connection: 'google_test', user: { permissions: ['board_view'] },
  });
  assert.doesNotMatch(textOf(display), /Öppna kalender|Öppna information/);
  assert.match(textOf(display), /Ekonomi/);

  window.VFPreviewViews.show('start', {
    connection: 'google_test', user: { permissions: ['own_fee'] },
  });
  assert.match(textOf(display), /Öppna kalender/);
  assert.match(textOf(display), /Öppna information/);
});

test('rollen styr uppgifter och dokument utan manuella medlems- eller styrelseval', () => {
  const window = {};
  const document = {
    createElement: node,
    createDocumentFragment: () => node('fragment'),
    addEventListener() {},
  };
  runInNewContext(readFileSync(new URL('../public/dashboard-views.js', import.meta.url), 'utf8'),
    { window, document, Date, Intl, Set });
  const display = node('main');
  display.id = 'screen-content';
  window.VFPreviewViews.attach(display);
  const tasks = { tasks: [
    { id: 'one', kind: 'medlem', text: 'Medlemsuppgift' },
    { id: 'two', kind: 'styrelse', text: 'Styrelseuppgift' },
    { id: 'three', kind: 'prioriterad', text: 'Prioriterad uppgift' },
  ] };

  window.VFPreviewViews.show('medlemsarbete', {
    connection: 'google_test', user: { permissions: ['own_fee'] }, tasks,
  });
  assert.match(textOf(display), /Medlemsuppgift/);
  assert.match(textOf(display), /Prioriterad uppgift/);
  assert.doesNotMatch(textOf(display), /Styrelseuppgift|För medlemmar|För styrelsen/);

  window.VFPreviewViews.show('medlemsarbete', {
    connection: 'google_test', user: { permissions: ['own_fee', 'board_view'] }, tasks,
  });
  assert.match(textOf(display), /Medlemsuppgift/);
  assert.match(textOf(display), /Styrelseuppgift/);
  assert.match(textOf(display), /Prioriterad uppgift/);
  assert.doesNotMatch(textOf(display), /För medlemmar|För styrelsen/);

  window.VFPreviewViews.show('dokument', {
    connection: 'google_test', user: { permissions: ['own_fee'] },
  });
  assert.match(textOf(display), /Medlemsdokument/);
  assert.doesNotMatch(textOf(display), /Styrelsedokument|För styrelsen/);

  window.VFPreviewViews.show('dokument', {
    connection: 'google_test', user: { permissions: ['own_fee', 'board_view'] },
  });
  assert.match(textOf(display), /Medlemsdokument/);
  assert.match(textOf(display), /Styrelsedokument/);
  assert.doesNotMatch(textOf(display), /För medlemmar|För styrelsen/);
});
