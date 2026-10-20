import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../experiments/apps-script-private-sheet-read/identity/Dashboard.html', import.meta.url), 'utf8');
const functionSource = source.match(/  async function openDocument\(id\) \{[\s\S]*?\n  \}\n\n  async function uploadDocument/);
assert.ok(functionSource, 'dokumentöppningen finns i publicerad HTML-källa');
const openSource = functionSource[0].replace(/\n\n  async function uploadDocument$/, '');

function harness(mimeType) {
  const calls = [];
  const file = { id: 'file-id', name: mimeType === 'application/pdf' ? 'Test.pdf' : 'Test.docx', mimeType };
  const popup = { closed: false, opener: 'original', location: { replace: value => calls.push(['tab', value]) } };
  const anchor = { hidden: false, click: () => calls.push(['download']), remove: () => calls.push(['remove']) };
  const context = {
    state: { connection: 'google_test', user: {}, documents: { documents: [file] } },
    window: { open: (...args) => { calls.push(['popup', ...args]); return popup; } },
    document: { createElement: () => anchor, body: { append: () => calls.push(['append']) } },
    URL: { createObjectURL: () => 'blob:test-document', revokeObjectURL: () => {} },
    Blob: class { constructor(bytes, options) { calls.push(['blob', bytes[0].length, options.type]); } },
    Uint8Array,
    atob: value => Buffer.from(value, 'base64').toString('binary'),
    call: async () => ({ allowed: true, data: { name: file.name, mimeType, content: 'JVBERg==' } }),
    show: () => {}, notice: () => {}, handleReadFailure: () => {}, accessRevoked: () => false,
    setTimeout: () => {},
  };
  runInNewContext(openSource + '\nthis.openDocument = openDocument;', context);
  return { openDocument: context.openDocument, calls, popup, anchor };
}

test('PDF öppnas i separat webbläsarflik', async () => {
  const app = harness('application/pdf');
  await app.openDocument('file-id');
  assert.deepEqual(app.calls.filter(item => item[0] === 'popup').length, 1);
  assert.deepEqual(app.calls.filter(item => item[0] === 'tab').map(item => item[1]), ['blob:test-document']);
  assert.equal(app.popup.opener, null);
  assert.equal(app.calls.some(item => item[0] === 'download'), false);
});

test('Office-fil lämnas till webbläsarens nedladdningshantering', async () => {
  const app = harness('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  await app.openDocument('file-id');
  assert.equal(app.calls.some(item => item[0] === 'popup'), false);
  assert.equal(app.anchor.download, 'Test.docx');
  assert.deepEqual(app.calls.filter(item => item[0] === 'download').length, 1);
});
