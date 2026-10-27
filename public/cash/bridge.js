(() => {
  'use strict';
  const status = document.getElementById('access-status');
  const nonce = crypto.randomUUID();
  const opener = window.opener;
  const pending = new Map();
  let origin = null;
  // HTML Service kör VF-skriptets innehåll på denna projektspecifika origin.
  // Om Google flyttar det till en annan origin stängs kopplingen tills den
  // nya adressen har verifierats och publicerats här.
  const trustedOrigin = 'https://n-eg65gknbhcukip5zkxrgs36zciqpzzcekdwdgbq-0lu-script.googleusercontent.com';
  let complete;
  let fail;
  const ready = new Promise((resolve, reject) => { complete = resolve; fail = reject; });
  const timeout = setTimeout(() => {
    if (origin) return;
    status.textContent = 'Ingen åtkomst. Google-kopplingen svarade inte.';
    fail(Error('Kassabehörigheten kunde inte bekräftas'));
  }, 20000);
  if (!opener) {
    clearTimeout(timeout);
    status.textContent = 'Öppna kassan från den inloggade appen.';
    fail(Error('Google-kopplingen saknas'));
  }
  window.addEventListener('message', event => {
    const data = event.data;
    if (!opener || event.source !== opener ||
        event.origin !== trustedOrigin || data?.nonce !== nonce) return;
    if (data.type === 'vf-cash-parent-result' &&
        typeof data.allowed === 'boolean' && !origin) {
      clearTimeout(timeout);
      if (!data.allowed) {
        status.textContent = 'Ingen åtkomst till kassan.';
        fail(Error('Ingen kassaåtkomst'));
        return;
      }
      origin = event.origin;
      status.hidden = true;
      document.documentElement.classList.add('authorized');
      complete();
      return;
    }
    if (data.type === 'vf-cash-parent-response' && origin === event.origin &&
        typeof data.requestId === 'string' && pending.has(data.requestId)) {
      const item = pending.get(data.requestId);
      clearTimeout(item.timer);
      pending.delete(data.requestId);
      item.resolve(data.result);
    }
  });
  if (opener && navigator.onLine) {
    opener.postMessage({ type:'vf-cash-parent-ready', nonce }, '*');
  } else if (opener) {
    clearTimeout(timeout);
    status.textContent = 'Kassan kan inte öppnas första gången utan anslutning.';
    fail(Error('Offline före behörighetskontroll'));
  }
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js', { scope:'./' }).catch(() => {});
  }
  window.VFCashBridge = Object.freeze({
    async request(action, input) {
      await ready;
      if (!navigator.onLine || !opener || opener.closed) {
        throw Error('Google-kopplingen är inte tillgänglig');
      }
      const requestId = crypto.randomUUID();
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(requestId);
          reject(Error('Google-kopplingen svarade inte'));
        }, 30000);
        pending.set(requestId, { resolve, reject, timer });
        opener.postMessage({ type:'vf-cash-parent-request', nonce,
          requestId, action, input:input ?? null }, origin);
      });
    }
  });
})();
