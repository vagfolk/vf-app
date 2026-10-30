import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const core = readFileSync(resolve(root, 'src/cash-register.mjs'), 'utf8')
  .replace(/\bexport function\b/g, 'function');
const posting = readFileSync(resolve(root, 'src/cash-posting.mjs'), 'utf8')
  .replace(/^import .*?;\r?\n/gm, '')
  .replace(/\bexport (async )?function\b/g, '$1function');
const wrapper = `var VFCashCore = (() => {\n${core}\n${posting}\nreturn { openCashRegister, addCashProduct,
  updateCashProduct, recordCashPurchase, voidCashPurchase, cashTotals,
  closeCashRegister, buildCashPostingPlan };\n})();`;
const client = readFileSync(resolve(here, 'CashClient.js'), 'utf8');
const backup = readFileSync(resolve(root, 'src/cash-local-backup.js'), 'utf8');
const shell = readFileSync(resolve(here, 'CashShell.html'), 'utf8');
const html = shell.replace('/*__VF_CASH_CORE__*/', wrapper)
  .replace('/*__VF_CASH_BACKUP__*/', backup)
  .replace('/*__VF_CASH_CLIENT__*/', client);
if (html.includes('/*__VF_CASH_')) throw new Error('Kassasidan saknar skript');
writeFileSync(resolve(here, 'Cash.html'), html);
const standalonePath = resolve(root, 'public/cash/index.html');
const standalone = readFileSync(standalonePath, 'utf8');
const standaloneCore = /<script>var VFCashCore = \(\(\) => \{[\s\S]*?\}\)\(\);<\/script>/;
if (!standaloneCore.test(standalone)) throw new Error('Fristående kassan saknar kärnmarkör');
const backupScript = /<script>\/\/ En separat, läsbar reservfil[\s\S]*?<\/script>/;
const standaloneClient = /<script>\(\(\) => \{[\s\S]*?\}\)\(\);\s*<\/script>/;
const googleCall = /  function call\(action, input\) \{[\s\S]*?\r?\n  \}\r?\n  async function request/;
if (!standaloneClient.test(standalone) || !googleCall.test(client)) {
  throw new Error('Fristående kassans klient eller Google-anrop kunde inte hittas');
}
const browserClient = client.replace(googleCall,
  '  function call(action, input) { return window.VFCashBridge.request(action, input); }\n  async function request');
let rebuilt = standalone.replace(standaloneCore, `<script>${wrapper}</script>`);
if (backupScript.test(rebuilt)) rebuilt = rebuilt.replace(backupScript, `<script>${backup}</script>`);
else rebuilt = rebuilt.replace('<script>(() => {', `<script>${backup}</script>\n  <script>(() => {`);
rebuilt = rebuilt.replace('  <script>/*__VF_CASH_BACKUP__*/</script>\n', '');
rebuilt = rebuilt.replace(standaloneClient, `<script>${browserClient}</script>`);
writeFileSync(standalonePath, rebuilt);
console.log('Båda kassasidorna byggda med bokföringsunderlag.');
