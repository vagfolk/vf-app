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
    addEventListener(type, callback) { (this.listeners ||= {})[type] = callback; },
    contains() { return true; },
    querySelector() { return { focus() {} }; },
  };
}

function textOf(current) {
  return [current.textContent, ...current.children.map(textOf)].join(' ');
}

function descendants(current) {
  return [current, ...current.children.flatMap(descendants)];
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
  const informationButton = descendants(display).find(item =>
    item.dataset.action === 'navigate' && item.dataset.value === 'information');
  assert.equal(informationButton?.textContent, 'Viktigt meddelande');
  assert.doesNotMatch(textOf(display), /Stäng vyn/);
  const createButton = descendants(display).find(item => item.dataset.action === 'open-task-form');
  assert.equal(createButton?.textContent, 'Att göra');
  assert.equal(descendants(display).some(item => item.dataset.form === 'task'), false);

  window.VFAppData = { user: { permissions: ['board_view'] } };
  display.listeners.click({ target: { closest() { return createButton; } } });
  assert.equal(descendants(display).some(item => item.dataset.form === 'task'), true);
  assert.match(textOf(display), /Medlem Styrelse Prioriterad/);
  window.VFPreviewViews.show('medlemsarbete', {
    connection: 'google_test', user: { permissions: ['board_view'] }, tasks: { tasks: [] },
  });
  window.VFPreviewViews.show('start', {
    connection: 'google_test', user: { permissions: ['board_view'] },
  });
  assert.equal(descendants(display).some(item => item.dataset.form === 'task'), false);

  window.VFPreviewViews.show('start', {
    connection: 'google_test', user: { permissions: ['own_fee'] },
  });
  assert.match(textOf(display), /Öppna kalender/);
  assert.match(textOf(display), /Öppna information/);
  assert.doesNotMatch(textOf(display), /Viktigt meddelande/);
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
  assert.equal(descendants(display).filter(item => item.dataset.action === 'task-toggle').length, 2);
  assert.equal(descendants(display).some(item => item.className?.includes('view-task-styrelse')), false);

  window.VFPreviewViews.show('medlemsarbete', {
    connection: 'google_test', user: { permissions: ['own_fee', 'board_view'] }, tasks,
  });
  assert.match(textOf(display), /Medlemsuppgift/);
  assert.match(textOf(display), /Styrelseuppgift/);
  assert.match(textOf(display), /Prioriterad uppgift/);
  assert.doesNotMatch(textOf(display), /För medlemmar|För styrelsen/);
  assert.equal(descendants(display).filter(item => item.dataset.action === 'task-toggle').length, 3);
  assert.equal(descendants(display).some(item => item.className?.includes('view-task-lower-board')), true);

  window.VFPreviewViews.show('dokument', {
    connection: 'google_test', user: { permissions: ['own_fee'] },
  });
  assert.match(textOf(display), /Medlemsdokument/);
  assert.doesNotMatch(textOf(display), /Styrelsedokument|För styrelsen/);
  assert.equal(descendants(display).some(item => item.className?.includes('view-document-board')), false);

  window.VFPreviewViews.show('dokument', {
    connection: 'google_test', user: { permissions: ['own_fee', 'board_view'] },
  });
  assert.match(textOf(display), /Medlemsdokument/);
  assert.match(textOf(display), /Styrelsedokument/);
  assert.doesNotMatch(textOf(display), /För medlemmar|För styrelsen/);
  assert.equal(descendants(display).some(item => item.className?.includes('view-document-columns-board')), true);
  assert.equal(descendants(display).filter(item => item.className?.includes('view-document-section')).length, 2);
});

test('Chat har Skicka bredvid textrutan och snabbvalen för sig', () => {
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
  window.VFPreviewViews.show('chat', { connection: 'google_test', chat: { messages: [] } });
  const compose = descendants(display).find(item => item.className === 'view-chat-compose');
  const shortcuts = descendants(display).find(item => item.className?.includes('view-chat-shortcuts'));
  assert.deepEqual(compose.children.map(item => item.tag), ['input', 'button']);
  assert.equal(compose.children[1].textContent, 'Skicka');
  assert.equal(shortcuts.children.length, 3);
  assert.equal(shortcuts.children.some(item => item.textContent === 'Skicka'), false);
});
