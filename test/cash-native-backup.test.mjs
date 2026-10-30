import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const source = readFileSync(new URL('../src/cash-local-backup.js', import.meta.url), 'utf8');
const operationId = '11111111-1111-4111-8111-111111111111';
const cash = {
  id:'K-2026-0002', associationId:'VF', ownerName:'Testperson',
  ownerMemberId:'TEST-0001', openedAt:'2026-10-30T10:00:00.000Z',
  openingFloatCents:0, purchases:[]
};
const record = { id:cash.id, cash, queue:[] };

test('installerad kassa skriver reservfil automatiskt utan filväljare', async () => {
  const calls = [];
  const context = { window:{
    showSaveFilePicker() { throw Error('Filväljaren ska inte öppnas'); },
    __TAURI__:{ core:{ invoke:async (name, args) => { calls.push({ name, args }); } } }
  }, Date };
  runInNewContext(source + '\nglobalThis.backup = VFCashBackup;', context);
  const backup = context.backup;
  assert.equal(backup.supported(), true);
  await backup.prepare(record);
  assert.equal(backup.active(cash.id), true);
  assert.equal(calls[0].name, 'cash_backup_prepare');
  const purchase = { operationId, id:'p-1', kind:'purchase', method:'Kontant',
    at:'2026-10-30T10:01:00.000Z', receivedCents:100 };
  const withPurchase = { ...record, cash:{ ...cash, purchases:[{
    id:'p-1', totalCents:100, lines:[{ name:'Kaffe', quantity:1, priceCents:100 }]
  }] }, queue:[purchase] };
  await backup.write(withPurchase);
  assert.equal(calls[1].name, 'cash_backup_write');
  assert.deepEqual([...calls[1].args.pendingIds], [operationId]);
  assert.match(calls[1].args.text, /Vara: Kaffe · 1 st/);
  await backup.write({ ...withPurchase, queue:[] }, [operationId]);
  assert.deepEqual([...calls[2].args.confirmedIds], [operationId]);
});

test('misslyckad native-skrivning spärrar fortsatt försäljning', async () => {
  let failed = false;
  const context = { window:{ __TAURI__:{ core:{ invoke:async name => {
    if (name === 'cash_backup_write' && !failed) {
      failed = true; throw Error('Disken är full');
    }
  } } } }, Date };
  runInNewContext(source + '\nglobalThis.backup = VFCashBackup;', context);
  await context.backup.prepare(record);
  await assert.rejects(context.backup.write(record), /Reservfilen kunde inte sparas/);
  assert.equal(context.backup.active(cash.id), false);
});
