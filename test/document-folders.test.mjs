import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../experiments/apps-script-private-sheet-read/identity/Code.gs', import.meta.url), 'utf8');
const associationId = 'VF-TEST-ASSOCIATION';
const memberFolderId = 'TEST_MEMBER_FOLDER_ID_0123456789';
const boardFolderId = 'TEST_BOARD_FOLDER_ID_0123456789';

function profileFor(roles) {
  const properties = new Map([
    ['VF_TEST_ASSOCIATION_ID', associationId],
    ['VF_MEMBER_DOCUMENT_FOLDER_ID', memberFolderId],
    ['VF_BOARD_DOCUMENT_FOLDER_ID', boardFolderId],
  ]);
  const context = {
    PropertiesService: {
      getScriptProperties: () => ({ getProperty: key => properties.get(key) ?? null }),
    },
  };
  runInNewContext(source, context);
  context.readTestData_ = () => ({ allowed: true, data: {
    associationId, memberId: 'M-1', name: 'Testperson', roles, online: 1,
  } });
  return JSON.parse(JSON.stringify(context.readDashboardData('profile').data));
}

test('medlem får bara medlemsdokumentens mapp', () => {
  assert.deepEqual(profileFor(['Medlem']).documentFolders, {
    member: `https://drive.google.com/drive/folders/${memberFolderId}`,
  });
});

test('styrelse får båda dokumentmapparna', () => {
  assert.deepEqual(profileFor(['Styrelse']).documentFolders, {
    member: `https://drive.google.com/drive/folders/${memberFolderId}`,
    board: `https://drive.google.com/drive/folders/${boardFolderId}`,
  });
});
