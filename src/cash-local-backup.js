// En separat, läsbar reservfil utanför webbläsarens lagring.
var VFCashBackup = (() => {
  let handle = null;
  let cashId = null;
  let lastError = '';
  const supported = () => typeof window.showSaveFilePicker === 'function';
  const active = id => Boolean(handle && cashId === id && !lastError);

  function readable(record) {
    const cash = record.cash;
    const events = record.queue || [];
    const lines = [
      'VÄGFÖLK 26 – RESERVLOGG FÖR EJ SYNKADE KASSAHÄNDELSER',
      `Kassa: ${record.id}`,
      `Förening: ${cash.associationId}`,
      `Öppnad: ${cash.openedAt}`,
      `Öppnad av: ${cash.ownerName || cash.ownerMemberId}`,
      `Växelkassa: ${(cash.openingFloatCents / 100).toFixed(2)} kr`,
      `Senast skriven: ${new Date().toISOString()}`,
      `Väntande händelser: ${events.length}`,
      '',
      'Kontrollera alltid samma kassa och köp-ID mot Drive innan manuell bokföring.',
      'En händelse kan ha hunnit synkas efter att denna fil senast skrevs.',
      ''
    ];
    for (const event of events) {
      lines.push(`Händelse: ${event.kind} · ${event.at} · ID ${event.operationId}`);
      if (event.kind === 'purchase') {
        const purchase = cash.purchases.find(item => item.id === event.id);
        lines.push(`Köp-ID: ${event.id}`,
          `Betalsätt: ${event.method}`,
          `Belopp: ${((purchase?.totalCents || 0) / 100).toFixed(2)} kr`);
        if (event.method === 'Kontant') lines.push(
          `Mottaget kontant: ${(event.receivedCents / 100).toFixed(2)} kr`,
          `Växel: ${((event.receivedCents - (purchase?.totalCents || 0)) / 100).toFixed(2)} kr`);
        for (const item of purchase?.lines || []) lines.push(
          `Vara: ${item.name} · ${item.quantity} st · ${(item.priceCents / 100).toFixed(2)} kr/st`);
      } else if (event.kind === 'void') {
        lines.push(`Makulerat köp-ID: ${event.purchaseId}`,
          `Orsak: ${event.reason}`,
          `Betalning mottagen: ${event.paymentReceived ? 'ja' : 'nej'}`,
          `Återbetalning: ${event.refundMethod || 'ingen'}`);
      } else if (event.kind === 'close') {
        lines.push(`Räknade kontanter: ${(event.countedCashCents / 100).toFixed(2)} kr`,
          `Avslutarens medlemsnummer: ${event.closerMemberId}`);
      } else if (event.kind === 'add_product') {
        lines.push(`Vara: ${event.product?.name || ''} · ${((event.product?.priceCents || 0) / 100).toFixed(2)} kr`);
      } else if (event.kind === 'update_product') {
        lines.push(`Vara-ID: ${event.productId} · nytt pris ${(event.priceCents / 100).toFixed(2)} kr`);
      }
      lines.push('');
    }
    if (!events.length) lines.push('Alla kassahändelser är bekräftade i Drive-loggen.');
    return lines.join('\n') + '\n';
  }

  async function write(record) {
    if (!handle || cashId !== record.id) throw Error('Välj reservfil för denna kassa');
    try {
      const stream = await handle.createWritable();
      try {
        await stream.write(readable(record));
        await stream.close();
      } catch (error) {
        await stream.abort().catch(() => {});
        throw error;
      }
      lastError = '';
    } catch (error) {
      lastError = 'Reservfilen kunde inte sparas';
      throw Error(lastError + ': ' + (error.message || 'okänt fel'));
    }
  }

  async function choose(record) {
    if (!supported()) throw Error('Den här webbläsaren kan inte skriva en fristående reservfil. Använd Chrome på Android eller dator.');
    const picked = await window.showSaveFilePicker({
      suggestedName: `VF26-reserv-${record.id}.txt`,
      types: [{ description: 'Läsbar kassalogg', accept: { 'text/plain': ['.txt'] } }]
    });
    const previous = await picked.getFile();
    const oldText = await previous.text();
    if (oldText.trim() && !oldText.includes(`Kassa: ${record.id}\n`)) {
      throw Error('Den valda reservfilen tillhör en annan kassa');
    }
    const oldIds = [...oldText.matchAll(/^Händelse: .* · ID ([^\s]+)$/gm)]
      .map(match => match[1]);
    const currentIds = new Set((record.queue || []).map(event => event.operationId));
    if (oldIds.some(id => !currentIds.has(id))) {
      throw Error('Reservfilen innehåller händelser som inte finns i kassans lokala väntelista. Jämför filen med Drive-loggen innan den skrivs över.');
    }
    handle = picked;
    cashId = record.id;
    await write(record);
  }

  return { supported, active, choose, write, error: () => lastError };
})();
