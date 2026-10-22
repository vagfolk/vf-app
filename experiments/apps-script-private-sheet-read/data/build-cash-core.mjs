import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const modules = ['cash-register.mjs', 'cash-posting.mjs', 'cash-qr.mjs'].map(name =>
  readFileSync(resolve(root, 'src', name), 'utf8')
    .replace(/^import .*?;\r?\n/gm, '')
    .replace(/\bexport (async )?function\b/g, '$1function'));
const source = `// Genererad från källmodulerna i src/cash-*.mjs.\n` +
  `// Ändra källmodulerna och kör build-cash-core.mjs igen.\n` +
  `var VFCashCore = (() => {\n` + modules.join('\n') +
  `\nreturn { openCashRegister, addCashProduct, updateCashProduct,\n` +
  `  recordCashPurchase, voidCashPurchase, cashTotals, closeCashRegister,\n` +
  `  verifyCashCloser, markCashSynced, reviewCashRegister, markCashPosted,\n` +
  `  markCashManuallyBooked, abortCashRegister, buildCashPostingPlan,\n` +
  `  buildPrefilledQrRequest };\n` +
  `})();\n`;
const target = resolve(here, 'CashCore.gs');
writeFileSync(target, source);
console.log('CashCore.gs byggd från testade kassaregler.');
