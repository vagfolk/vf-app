import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

test('den publicerbara appvyn motsvarar sina separata källfiler', () => {
  const built = read('../experiments/apps-script-private-sheet-read/identity/Dashboard.html');
  assert.equal(read('../public/dashboard-google.html'), built);
  for (const [path, wrapper] of [
    ['../public/dashboard.css', 'style'],
    ['../public/dashboard-views.js', 'script'],
    ['../experiments/apps-script-private-sheet-read/identity/DashboardClient.js', 'script'],
  ]) {
    const source = read(path);
    assert.ok(built.includes(`<${wrapper}>\n${source}\n</${wrapper}>`),
      `${path} måste finnas oförändrad i den byggda appvyn`);
  }
});
