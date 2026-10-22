// Kassans koppling till den befintliga EKO-testkopian. Endast kontantposter
// skrivs automatiskt. Swish bokförs manuellt av kassören, en rad per betalning.
function cashEkoDateSerial_(isoDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) throw new Error('invalid_cash_date');
  const time = Date.parse(isoDate + 'T00:00:00Z');
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== isoDate) {
    throw new Error('invalid_cash_date');
  }
  return time / 86400000 + 25569;
}
function cashEkoSnapshot_(spreadsheetId) {
  const header = readRange_(spreadsheetId, "'Kassabok'!A11:I11")[0] || [];
  if (header[0] !== 'Datum' || header[1] !== 'Typ' ||
      header[2] !== 'Kategori' || header[3] !== 'Betalsätt' ||
      header[5] !== 'Belopp' || header[6] !== 'Kvitto-/fakturanr') {
    throw new Error('cash_eko_structure_changed');
  }
  const categories = readRange_(spreadsheetId, "'Grunddata'!D27:E48");
  const active = new Set(categories.filter(row => row[1] === 'Ja').map(row => row[0]));
  if (categories.filter(row => row[0] === 'Försäljning' && row[1] === 'Ja').length !== 1 ||
      categories.filter(row => row[0] === 'Försäljning').length !== 1) {
    throw new Error('cash_eko_category_missing');
  }
  const period = readRange_(spreadsheetId, "'Grunddata'!B10:B11");
  if (!Number.isFinite(period[0]?.[0]) || !Number.isFinite(period[1]?.[0]) ||
      period[0][0] > period[1][0]) throw new Error('cash_eko_structure_changed');
  return { rows: readRange_(spreadsheetId, "'Kassabok'!A12:I2011", true),
    active, periodStart: period[0][0], periodEnd: period[1][0] };
}
function cashEkoRowsByReference_(rows) {
  const map = new Map();
  rows.forEach((row, index) => {
    const reference = row[6];
    if (!reference) return;
    const hits = map.get(reference) || [];
    hits.push({ row, index: index + 12 });
    map.set(reference, hits);
  });
  return map;
}
function cashEkoSameCashRow_(actual, planned) {
  return Math.abs(Number(actual[0]) - cashEkoDateSerial_(planned.date)) < 0.000001 &&
    actual[1] === planned.type && actual[2] === planned.category &&
    actual[3] === 'Kontant' && actual[4] === planned.description &&
    Math.abs(Number(actual[5]) - planned.amountCents / 100) < 0.005 &&
    actual[6] === planned.reference && Number(actual[8]) === 1;
}
function cashEkoFindBlank_(rows, reserved) {
  for (let index = 0; index < 2000; index++) {
    const row = rows[index] || [];
    if (!reserved.has(index + 12) &&
        row.slice(0, 7).every(value => value === '' || value == null)) return index + 12;
  }
  throw new Error('cash_eko_full');
}
function cashEkoWriteCash_(spreadsheetId, cash, associationId) {
  if (cash.associationId !== associationId || cash.status !== 'approved_for_posting') {
    throw new Error('cash_not_approved');
  }
  const plan = VFCashCore.buildCashPostingPlan(cash);
  let snapshot = cashEkoSnapshot_(spreadsheetId);
  const date = cashEkoDateSerial_(plan.date);
  if (date < snapshot.periodStart || date > snapshot.periodEnd) {
    throw new Error('cash_eko_period_mismatch');
  }
  let references = cashEkoRowsByReference_(snapshot.rows);
  for (const row of plan.rows) {
    const existing = references.get(row.reference) || [];
    if (existing.length > 1 || (existing.length === 1 &&
        !cashEkoSameCashRow_(existing[0].row, row))) {
      throw new Error('cash_eko_conflict');
    }
  }
  const reserved = new Set();
  const missing = plan.rows.filter(row => !(references.get(row.reference) || []).length);
  const data = missing.map(row => {
    const sheetRow = cashEkoFindBlank_(snapshot.rows, reserved);
    reserved.add(sheetRow);
    return { range: "'Kassabok'!A" + sheetRow + ':G' + sheetRow,
      values: [[cashEkoDateSerial_(row.date), row.type, row.category,
        'Kontant', row.description, row.amountCents / 100, row.reference]] };
  });
  if (data.length) {
    sheetsRequest_('https://sheets.googleapis.com/v4/spreadsheets/' +
      encodeURIComponent(spreadsheetId) + '/values:batchUpdate', 'post', {
        valueInputOption: 'RAW', data: data
      }, ScriptApp.getOAuthToken());
    snapshot = cashEkoSnapshot_(spreadsheetId);
    references = cashEkoRowsByReference_(snapshot.rows);
  }
  // Vid ett oklart nätverkssvar återupptar nästa försök från redan funna
  // referenser. Spara aldrig godkännandet förrän samtliga rader lästs tillbaka.
  for (const row of plan.rows) {
    const written = references.get(row.reference) || [];
    if (written.length !== 1 || !cashEkoSameCashRow_(written[0].row, row)) {
      throw new Error('cash_eko_write_unverified');
    }
  }
  return { cashRows: plan.rows.length, swishToBook: plan.swishForManual.length };
}
function cashEkoVerifyManualSwish_(spreadsheetId, cash, associationId) {
  if (cash.associationId !== associationId || cash.status !== 'approved_for_posting' ||
      !cash.cashPosting) throw new Error('cash_not_approved');
  const plan = VFCashCore.buildCashPostingPlan(cash);
  const snapshot = cashEkoSnapshot_(spreadsheetId);
  const references = cashEkoRowsByReference_(snapshot.rows);
  const expectedDate = cashEkoDateSerial_(plan.date);
  if (expectedDate < snapshot.periodStart || expectedDate > snapshot.periodEnd) {
    throw new Error('cash_eko_period_mismatch');
  }
  for (const payment of plan.swishForManual) {
    const hits = references.get(payment.reference) || [];
    if (!hits.length) throw new Error('cash_swish_not_booked');
    const row = hits.length === 1 && hits[0].row;
    if (!row || Math.abs(Number(row[0]) - expectedDate) >= 0.000001 ||
        row[1] !== 'Inkomst' || row[3] !== 'Swish' ||
        !snapshot.active.has(row[2]) ||
        Math.abs(Number(row[5]) - payment.amountCents / 100) >= 0.005 ||
        Number(row[8]) !== 1) throw new Error('cash_swish_eko_conflict');
  }
  return { verifiedSwish: plan.swishForManual.length };
}
