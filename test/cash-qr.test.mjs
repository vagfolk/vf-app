import test from 'node:test';
import assert from 'node:assert/strict';
import { openCashRegister } from '../src/cash-register.mjs';
import { buildPrefilledQrRequest } from '../src/cash-qr.mjs';

const cash = openCashRegister({ id:'K-2026-0042', associationId:'vf-test',
  ownerMemberId:'M-100', deviceId:'device-1', openedAt:'2026-10-21T10:00:00.000Z',
  accountingDate:'2026-10-21', openingFloatCents:0,
  products:[{ id:'coffee', name:'Kaffe', priceCents:2000 },
    { id:'bun', name:'Bulle', priceCents:1500 }] });

test('QR fyller föreningens nummer, exakt köpbelopp och unik referens', () => {
  const purchaseId = '123e4567-e89b-42d3-a456-426614174000';
  const qr = buildPrefilledQrRequest(cash, purchaseId,
    [{ productId:'coffee', quantity:1 }, { productId:'bun', quantity:2 }],
    '1234567890');
  assert.equal(qr.amountCents, 5000);
  assert.equal(qr.reference, `K-2026-0042-${purchaseId}`);
  assert.deepEqual(qr.payload, { format:'png', size:400,
    payee:{ value:'1234567890', editable:false },
    amount:{ value:50, editable:false },
    message:{ value:qr.reference, editable:false } });
  assert.ok(qr.reference.length <= 50);
});

test('QR avvisar saknat nummer, okänd vara och för lång referens', () => {
  const lines = [{ productId:'coffee', quantity:1 }];
  assert.throws(() => buildPrefilledQrRequest(cash, 'purchase1', lines, ''),
    /Swishnummer/);
  assert.throws(() => buildPrefilledQrRequest(cash, 'purchase1',
    [{ productId:'missing', quantity:1 }], '1234567890'), /vara/);
  const longId = { ...cash, id:'K-2026-0000000001' };
  assert.throws(() => buildPrefilledQrRequest(longId, 'x'.repeat(36), lines,
    '1234567890'), /för lång/);
});
