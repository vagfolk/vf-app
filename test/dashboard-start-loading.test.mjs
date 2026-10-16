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
