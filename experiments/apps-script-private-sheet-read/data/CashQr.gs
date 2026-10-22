// Förifylld Swish-QR. Betalningen verifieras inte av detta anrop.
// API: https://developer.swish.nu/api/qr-codes/v1
function cashQrCreate_(cash, input, properties) {
  const number = properties.getProperty(CASH_SWISH_NUMBER_PROPERTY);
  if (properties.getProperty(CASH_SWISH_ENABLED_PROPERTY) !== 'true' ||
      !/^\d{10,15}$/.test(number || '')) throw new Error('cash_swish_disabled');
  const prepared = VFCashCore.buildPrefilledQrRequest(cash,
    input.purchaseId, input.lines, number);
  const response = UrlFetchApp.fetch('https://mpc.getswish.net/qrg-swish/api/v1/prefilled', {
    method: 'post', contentType: 'application/json',
    payload: JSON.stringify(prepared.payload), muteHttpExceptions: true
  });
  if (response.getResponseCode() !== 200) throw new Error('cash_qr_unavailable');
  const bytes = response.getBlob().getBytes();
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (bytes.length < 100 || bytes.length > 300000 ||
      signature.some((value, index) => (bytes[index] & 255) !== value)) {
    throw new Error('cash_qr_unavailable');
  }
  return { purchaseId: input.purchaseId, amountCents: prepared.amountCents,
    reference: prepared.reference,
    image: 'data:image/png;base64,' + Utilities.base64Encode(bytes) };
}
