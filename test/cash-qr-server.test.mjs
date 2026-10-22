import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { buildPrefilledQrRequest } from '../src/cash-qr.mjs';
import { openCashRegister } from '../src/cash-register.mjs';

const source = readFileSync(new URL('../experiments/apps-script-private-sheet-read/data/CashQr.gs',
  import.meta.url), 'utf8');
const cash = openCashRegister({ id:'K-2026-0042', associationId:'vf-test',
  ownerMemberId:'M-100', deviceId:'device-1', openedAt:'2026-10-21T10:00:00.000Z',
  accountingDate:'2026-10-21', openingFloatCents:0,
  products:[{ id:'coffee', name:'Kaffe', priceCents:2000 }] });

test('QR-servern använder Swish förifyllda PNG och lämnar bara kod och belopp', () => {
  const calls = [];
  const bytes = Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),
    Buffer.alloc(120)]);
  const context = {
    CASH_SWISH_ENABLED_PROPERTY:'enabled', CASH_SWISH_NUMBER_PROPERTY:'number',
    VFCashCore:{ buildPrefilledQrRequest },
    Utilities:{ base64Encode:value => Buffer.from(value).toString('base64') },
    UrlFetchApp:{ fetch:(url, options) => {
      calls.push({ url, options });
      return { getResponseCode:() => 200,
        getBlob:() => ({ getBytes:() => [...bytes] }) };
    } }
  };
  runInNewContext(source, context);
  const properties = { getProperty:key => ({ enabled:'true', number:'1234567890' })[key] };
  const input = { purchaseId:'123e4567-e89b-42d3-a456-426614174000',
    lines:[{ productId:'coffee', quantity:1 }] };
  const result = context.cashQrCreate_(cash, input, properties);
  assert.equal(result.amountCents, 2000);
  assert.match(result.image, /^data:image\/png;base64,/);
  assert.equal(calls[0].url,
    'https://mpc.getswish.net/qrg-swish/api/v1/prefilled');
  assert.equal(JSON.parse(calls[0].options.payload).message.value, result.reference);
  assert.equal(JSON.parse(calls[0].options.payload).amount.value, 20);
});

test('QR-servern anropar inte Swish när funktionen inte är aktiverad', () => {
  const context = { CASH_SWISH_ENABLED_PROPERTY:'enabled',
    CASH_SWISH_NUMBER_PROPERTY:'number', VFCashCore:{ buildPrefilledQrRequest },
    UrlFetchApp:{ fetch:() => { throw Error('network_should_not_run'); } } };
  runInNewContext(source, context);
  const props = { getProperty:key => key === 'enabled' ? 'false' : '1234567890' };
  assert.throws(() => context.cashQrCreate_(cash, { purchaseId:'purchase1',
    lines:[{ productId:'coffee', quantity:1 }] }, props), /cash_swish_disabled/);
});
