import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../experiments/apps-script-private-sheet-read/data/Code.gs', import.meta.url), 'utf8');
const memberFolder = 'member_folder_0123456789';
const boardFolder = 'board_folder_0123456789';
const memberFile = 'member_file_0123456789';
const boardFile = 'board_file_0123456789';
const outsideFile = 'outside_file_0123456789';

function harness(boardAllowed) {
  const settings = new Map([
    ['VF_TEST_DOCUMENT_MEMBER_ID', memberFolder],
    ['VF_TEST_DOCUMENT_BOARD_ID', boardFolder],
    ['VF_TEST_SPREADSHEET_ID', 'eko_file_0123456789'],
  ]);
  const role = JSON.stringify({ board: boardAllowed, eko: '2026-10-19T00:00:00Z' });
  const calls = [];
  const context = {
    ScriptApp: { getOAuthToken: () => 'token' },
    CacheService: { getScriptCache: () => ({ get: () => role }) },
    Utilities: { base64Encode: bytes => Buffer.from(bytes).toString('base64'), getUuid: () => 'test-uuid' },
    UrlFetchApp: { fetch: url => {
      calls.push(url);
      return { getResponseCode: () => 200, getContent: () => [65, 66] };
    } },
  };
  runInNewContext(source, context);
  const properties = {
    getProperty: name => settings.get(name) ?? null,
    setProperty: (name, value) => settings.set(name, value),
  };
  const files = [
    { id: memberFile, name: 'Medlem.pdf', mimeType: 'application/pdf', size: '2', parents: [memberFolder] },
    { id: boardFile, name: 'Styrelse.pdf', mimeType: 'application/pdf', size: '2', parents: [boardFolder] },
    { id: outsideFile, name: 'Annan.pdf', mimeType: 'application/pdf', size: '2', parents: ['other_folder'] },
  ];
  context.driveRequest_ = (url, method, body) => {
    calls.push(url);
    if (method === 'patch') return { id: url.match(/files\/([^?]+)/)?.[1], trashed: body.trashed };
    if (url.includes('/files?q=')) {
      const folder = decodeURIComponent(new URL(url).searchParams.get('q'));
      return { files: files.filter(file => folder.includes(file.parents[0])) };
    }
    return files.find(file => url.includes(file.id));
  };
  context.readDriveModified_ = () => role && '2026-10-19T00:00:00Z';
  context.reply_ = (allowed, reason, data) => ({ allowed, reason, data });
  context.readRange_ = () => { throw new Error('EKO-rader ska inte läsas när en fil öppnas'); };
  return { context, properties, calls };
}

test('medlem får endast dokument från Medlem', () => {
  const { context, properties } = harness(false);
  const documents = context.visibleDocuments_(properties, false);
  assert.equal(documents.length, 1);
  assert.equal(documents[0].id, memberFile);
  assert.equal(documents[0].kind, 'member');
});

test('styrelse får dokument från båda mapparna', () => {
  const { context, properties } = harness(true);
  const documents = context.visibleDocuments_(properties, true);
  assert.deepEqual(Array.from(documents, item => item.id), [memberFile, boardFile]);
});

test('fil-ID för styrelsedokument räcker inte för medlem', () => {
  const { context, properties, calls } = harness(false);
  const response = context.openDocument_(boardFile, 'subject', 'association', properties);
  assert.equal(response.allowed, false);
  assert.equal(response.reason, 'insufficient_role');
  assert.equal(calls.some(url => url.includes('alt=media')), false);
});

test('styrelsen kan öppna styrelsedokument utan ny EKO-radläsning', () => {
  const { context, properties, calls } = harness(true);
  const response = context.openDocument_(boardFile, 'subject', 'association', properties);
  assert.equal(response.allowed, true);
  assert.equal(response.data.content, 'QUI=');
  assert.equal(calls.some(url => url.includes('alt=media')), true);
});

test('borttagning flyttar en appfil till papperskorgen och ändrar dokumentversionen', () => {
  const { context, properties, calls } = harness(true);
  const response = context.deleteDocument_(boardFile, properties);
  assert.equal(response.allowed, true);
  assert.equal(response.data.saved, true);
  assert.equal(calls.some(url => url.includes(boardFile) && url.includes('fields=id,trashed')), true);
  assert.ok(properties.getProperty('VF_TEST_DOCUMENT_VERSION'));
});

test('borttagning av fil utanför dokumentmapparna nekas', () => {
  const { context, properties, calls } = harness(true);
  const response = context.deleteDocument_(outsideFile, properties);
  assert.equal(response.allowed, false);
  assert.equal(response.reason, 'invalid_document');
  assert.equal(calls.some(url => url.includes(outsideFile) && url.includes('fields=id,trashed')), false);
});
