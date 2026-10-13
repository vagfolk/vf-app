import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(here, '../../../public');
const publicUrl = 'https://vagfolk.github.io/vf-app/public/';
let html = readFileSync(resolve(publicDir, 'dashboard.html'), 'utf8');

function inject(original, replacement) {
  if (html.split(original).length !== 2) throw new Error(`Saknad eller upprepad markör: ${original}`);
  html = html.replace(original, replacement);
}
function script(contents) {
  if (/<\/script/i.test(contents)) throw new Error('Ett skript innehåller en avslutande HTML-tagg');
  return `<script>\n${contents}\n</script>`;
}

inject('<meta charset="utf-8">', '<meta charset="utf-8">\n  <base target="_top">');
inject('<link rel="stylesheet" href="dashboard.css">',
  `<style>\n${readFileSync(resolve(publicDir, 'dashboard.css'), 'utf8')}\n</style>`);
inject('<script src="dashboard-views.js"></script>',
  script(readFileSync(resolve(publicDir, 'dashboard-views.js'), 'utf8')));
inject('<script src="dashboard-app.js" defer></script>',
  script(readFileSync(resolve(here, 'DashboardClient.js'), 'utf8')));
inject("new URL('dashboard-assets/', document.baseURI)",
  `new URL('${publicUrl}dashboard-assets/')`);
inject("new URL('dashboard-assets/assets/menu-experiments/aktiv-knapp-utan-text.png', document.baseURI)",
  `new URL('${publicUrl}dashboard-assets/assets/menu-experiments/aktiv-knapp-utan-text.png')`);
inject("fetch('placements.json')", `fetch('${publicUrl}placements.json')`);
// HtmlService kapar en URL i en template literal vid https://. Bygg samma URL
// med vanliga strängdelar så att Googles HTML-sanerare behåller hela skriptet.
inject('fetch(`https://opendata-download-metfcst.smhi.se/api/category/snow1g/version/1/geotype/point/lon/${lon}/lat/${lat}/data.json?timeseries=4&parameters=air_temperature`,',
  "fetch('https://opendata-download-metfcst.smhi.se/api/category/snow1g/version/1/geotype/point/lon/' + lon + '/lat/' + lat + '/data.json?timeseries=4&parameters=air_temperature',");

writeFileSync(resolve(here, 'Dashboard.html'), html);
console.log('Dashboard.html byggd av granskad GitHub-vy utan inbäddade nycklar.');
