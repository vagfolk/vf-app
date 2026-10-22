import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const core = readFileSync(resolve(root, 'src/cash-register.mjs'), 'utf8')
  .replace(/\bexport function\b/g, 'function');
const wrapper = `var VFCashCore = (() => {\n${core}\nreturn { openCashRegister, addCashProduct,
  updateCashProduct, recordCashPurchase, voidCashPurchase, cashTotals,
  closeCashRegister };\n})();`;
const client = readFileSync(resolve(here, 'CashClient.js'), 'utf8');
const shell = readFileSync(resolve(here, 'CashShell.html'), 'utf8');
const html = shell.replace('/*__VF_CASH_CORE__*/', wrapper)
  .replace('/*__VF_CASH_CLIENT__*/', client);
if (html.includes('/*__VF_CASH_')) throw new Error('Kassasidan saknar skript');
writeFileSync(resolve(here, 'Cash.html'), html);
console.log('Cash.html byggd utan externa skript eller nycklar.');
