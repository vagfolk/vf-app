(() => {
  'use strict';
  const status = document.getElementById('status');
  const bridgeUrl = 'https://script.google.com/macros/s/AKfycbwFDUhKlZBpBKeZk58S19TwStQ2jYR2GXl6Qs_hb_afniBQYmGR7EOjM1RwZON1fjs/exec?view=cash_bridge';
  const useParent = new URL(location.href).searchParams.get('bridge') === 'parent';
  const nonce = crypto.randomUUID();
  let bridge;
  let bridgeSource;
  let bridgeOrigin;
  let verified = false;
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js', { scope:'./' })
      .catch(() => { status.textContent = 'Offlineöppning kunde inte förberedas.'; });
  }
  let timeout;
  function connect() {
    if (!navigator.onLine) return;
    if (useParent) {
      if (!window.opener) {
        status.textContent = 'Ingen åtkomst. Öppna kassafönstret från den inloggade appen.';
        return;
      }
      status.textContent = 'Kontrollerar behörighet via den inloggade appen…';
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        if (!verified) status.textContent = 'Ingen åtkomst. Appen kunde inte bekräfta kassabehörigheten.';
      }, 15000);
      // Startsignalen innehåller ingen profil eller kassadata. Google kör
      // HTML Service på en dynamisk origin, så svaret binds i stället till
      // exakt det fönster som öppnade denna sida och en engångskod.
      window.opener.postMessage({ type:'vf-cash-parent-ready', nonce }, '*');
      return;
    }
    if (bridge) return;
    status.textContent = 'Kontrollerar behörighet via Google…';
    timeout = setTimeout(() => {
      if (!verified) status.textContent = 'Ingen åtkomst. Google kunde inte bekräfta kassabehörigheten.';
    }, 15000);
    bridge = document.createElement('iframe');
    bridge.id = 'bridge';
    bridge.title = 'Skyddad Google-koppling';
    bridge.src = bridgeUrl + '&nonce=' + encodeURIComponent(nonce);
    document.body.append(bridge);
  }
  window.addEventListener('message', event => {
    let host;
    try { host = new URL(event.origin).hostname; } catch (_) { return; }
    if (useParent) {
      if (event.source !== window.opener || event.data?.nonce !== nonce ||
          event.data?.type !== 'vf-cash-parent-result' ||
          (host !== 'script.google.com' && !host.endsWith('.googleusercontent.com')) ||
          typeof event.data.allowed !== 'boolean') return;
      clearTimeout(timeout);
      verified = true;
      status.textContent = event.data.allowed
        ? 'Google bekräftade behörighet att hantera kassan.'
        : 'Ingen åtkomst till kassan.';
      return;
    }
    // HTML Service kör innehållet i en inre Google-ram. Dess avsändarfönster
    // är därför inte samma fönster som den yttre iframe som vi skapade.
    if (!bridge || event.data?.nonce !== nonce ||
        (host !== 'script.google.com' && !host.endsWith('.googleusercontent.com'))) return;
    if (event.data?.type === 'vf-cash-bridge-ready' && !bridgeSource) {
      bridgeSource = event.source;
      bridgeOrigin = event.origin;
      status.textContent = 'Google-kopplingen svarade. Kontrollerar kassabehörighet…';
      // Google placerar HTML Service i en egen ram. Svara alltid till den
      // faktiska avsändaren och dess exakta origin, aldrig med jokertecken.
      bridgeSource.postMessage({ type:'vf-cash-bridge-check', nonce }, bridgeOrigin);
    }
    if (event.data?.type === 'vf-cash-bridge-result' &&
        event.source === bridgeSource && event.origin === bridgeOrigin &&
        typeof event.data.allowed === 'boolean') {
      clearTimeout(timeout); verified = true;
      status.textContent = event.data.allowed
        ? 'Google bekräftade behörighet att hantera kassan.'
        : 'Google bekräftade inte behörighet att hantera kassan.';
    }
  });
  if (navigator.onLine) connect();
  else status.textContent = 'Appskalet är öppet utan nät. Ingen kassa visas innan behörigheten har kontrollerats online.';
  window.addEventListener('online', connect);
})();
