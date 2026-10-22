// Swishs förifyllda QR-kod öppnar bara kundens betalningsformulär.
// Den bevisar inte att betalningen har genomförts.
export function buildPrefilledQrRequest(cash, purchaseId, lines, payee) {
  if (cash?.status !== 'open' || !Array.isArray(cash.products)) {
    throw new Error('Kassan är inte öppen');
  }
  if (typeof payee !== 'string' || !/^\d{10,15}$/.test(payee)) {
    throw new Error('Föreningens Swishnummer saknas');
  }
  if (typeof purchaseId !== 'string' || !/^[A-Za-z0-9-]{8,36}$/.test(purchaseId)) {
    throw new Error('Ogiltigt köp-ID');
  }
  const reference = `${cash.id}-${purchaseId}`;
  if (reference.length > 50 || !/^[-A-Za-z0-9]+$/.test(reference)) {
    throw new Error('Köpreferensen är för lång');
  }
  if (!Array.isArray(lines) || !lines.length || lines.length > 100) {
    throw new Error('Köpet saknar varor');
  }
  const seen = new Set();
  let amountCents = 0;
  for (const line of lines) {
    const product = cash.products.find(item => item.id === line.productId);
    if (!product || seen.has(product.id) || !Number.isSafeInteger(line.quantity) ||
        line.quantity < 1 || line.quantity > 10000) throw new Error('Ogiltig vara');
    seen.add(product.id);
    amountCents += product.priceCents * line.quantity;
  }
  if (!Number.isSafeInteger(amountCents) || amountCents < 1 || amountCents > 100000000) {
    throw new Error('Ogiltigt köpbelopp');
  }
  return { amountCents, reference, payload: {
    format: 'png', size: 400,
    payee: { value: payee, editable: false },
    amount: { value: amountCents / 100, editable: false },
    message: { value: reference, editable: false }
  } };
}
