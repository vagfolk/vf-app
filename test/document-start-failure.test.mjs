import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL(
  '../experiments/apps-script-private-sheet-read/identity/DashboardClient.js',
  import.meta.url), 'utf8');
const functions = source.match(/  async function readDocuments\(\) \{[\s\S]*?\n  \}\n  function checkUpdates/);
assert.ok(functions, 'start och dokumentläsning finns i appens källfil');
const code = functions[0].replace(/\n  function checkUpdates$/, '');

function app(documentFailure) {
  const state = { connection: 'checking' };
  const notices = [];
  const read = async action => {
    if (action === 'documents') throw documentFailure;
    if (action === 'profile') return { permissions: ['own_fee'], online: 1 };
    if (action === 'own_fee') return { memberId: 'TEST-MEDLEM' };
    if (action === 'app_versions') return { online: 1 };
    return {};
  };
  const context = {
    state, read, Date,
    accessRevoked: error => ['unknown_user', 'inactive_user', 'insufficient_role']
      .includes(error?.reason),
    show() {}, notice: message => notices.push(message),
    calendarDay: '', lastUpdateCheckAt: 0,
  };
  runInNewContext(code + '\nthis.start = start;', context);
  return { start: context.start, state, notices };
}

test('tillfälligt dokumentfel hindrar inte appinloggning', async () => {
  const current = app(new Error('Tillfälligt Drive-fel'));
  await current.start();
  assert.equal(current.state.connection, 'google_test');
  assert.equal(current.state.documents.error, true);
  assert.deepEqual(Array.from(current.state.documents.documents), []);
});

test('nekat medlemskap vid dokumentläsning stoppar appinloggningen', async () => {
  const error = new Error('Åtkomst nekad');
  error.reason = 'inactive_user';
  const current = app(error);
  await current.start();
  assert.equal(current.state.connection, 'error');
  assert.equal(current.state.user, null);
  assert.equal(current.state.documents, null);
});
