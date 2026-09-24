// -------------------------------------------------------
// AUTH.JS – Google OAuth via GIS Token Client
// -------------------------------------------------------

let currentUser = null;
let accessToken  = null;
let tokenClient  = null;

// Initialize token client (no popup, no redirect)
function initAuth() {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: async (response) => {
      if (response.error) {
        showLoginError('Inloggning misslyckades: ' + response.error);
        return;
      }
      accessToken = response.access_token;
      await handleTokenReceived();
    }
  });

  // Show login button
  const btn = document.getElementById('googleSignInBtn');
  if (btn) {
    btn.innerHTML = `
      <button onclick="startGoogleLogin()" style="
        display:flex;align-items:center;gap:12px;
        padding:12px 24px;border:1px solid #dadce0;
        border-radius:6px;background:#fff;cursor:pointer;
        font-family:'IBM Plex Sans',sans-serif;font-size:15px;
        font-weight:500;color:#3c4043;margin:0 auto;">
        <svg width="18" height="18" viewBox="0 0 48 48">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
        </svg>
        Logga in med Google
      </button>`;
  }
}

function startGoogleLogin() {
  tokenClient.requestAccessToken({ prompt: 'select_account' });
}

async function handleTokenReceived() {
  try {
    // Get user info
    const res  = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { 'Authorization': 'Bearer ' + accessToken }
    });
    const info = await res.json();
    console.log('Logged in as:', info.email);

    // Look up in VF-EKO
    const member = await lookupMember(info.email);
    if (!member) {
      showLoginError('Du verkar inte vara registrerad medlem. Kontakta styrelsen.');
      accessToken = null;
      return;
    }

    currentUser = {
      name:      info.name || member.namn || info.email,
      email:     info.email,
      role:      member.approll || 'Medlem',
      payStatus: member.payStatus,
      payDue:    member.payDue
    };

    onLoginSuccess();
  } catch (err) {
    console.error('handleTokenReceived error:', err);
    showLoginError('Något gick fel. Försök igen.');
  }
}

async function lookupMember(email) {
  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEETS_VFEKO_ID}/values/Medlemmar%21A1%3AZ300`;
    const res  = await apiFetch(url);
    const data = await res.json();
    console.log('Sheets response status:', res.status);
    console.log('Sheets data:', data);
    const rows = data.values || [];
    if (rows.length < 2) return null;

    let headerIdx = -1;
    let colEmail = -1, colNamn = -1, colApproll = -1;
    let colBetalat = -1, colForfall = -1, colRadstatus = -1;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i].map(v => (v || '').toString().trim().toUpperCase().replace(/[\n\r\s]+/g, ' '));
      if (row.includes('E-POST')) {
        headerIdx    = i;
        colEmail     = row.indexOf('E-POST');
        colNamn      = row.indexOf('NAMN');
        colApproll   = row.indexOf('APPROLL');
        colBetalat   = row.indexOf('BETALAT');
        colForfall   = row.findIndex(h => h.includes('BETALD') && h.includes('DATUM'));
        colRadstatus = row.indexOf('RADSTATUS');
        console.log('Header found at row', i, '| E-POST col:', colEmail, '| APPROLL col:', colApproll);
        break;
      }
    }
    if (headerIdx === -1) { console.error('Header row not found!'); return null; }

    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row      = rows[i];
      const rowEmail = (row[colEmail] || '').trim().toLowerCase();
      if (rowEmail === email.toLowerCase()) {
        const status = (row[colRadstatus] || '').trim().toLowerCase();
        if (status === 'inaktiv' || status === 'borttagen') return null;

        const betalat    = (row[colBetalat] || '').trim().toLowerCase() === 'ja';
        const forfallStr = (row[colForfall] || '').trim();
        const payDue     = forfallStr ? new Date(forfallStr) : null;

        let payStatus = 'green';
        if (!betalat) {
          payStatus = 'red';
        } else if (payDue) {
          const daysLeft = Math.floor((payDue - new Date()) / (1000 * 60 * 60 * 24));
          if (daysLeft <= 30) payStatus = 'yellow';
        }

        return {
          namn:      (row[colNamn] || '').trim(),
          approll:   (row[colApproll] || 'Medlem').trim(),
          betalat,
          payDue:    payDue ? payDue.toLocaleDateString('sv-SE') : null,
          payStatus
        };
      }
    }
    console.warn('Email not found in sheet:', email);
    return null;
  } catch (err) {
    console.error('lookupMember error:', err);
    return null;
  }
}

function onLoginSuccess() {
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('appShell').classList.remove('hidden');

  const role = currentUser.role.toLowerCase();
  document.body.classList.remove('role-member', 'role-board');
  if (role.includes('styrelse') || role.includes('kassör') || role.includes('sekreterare')) {
    document.body.classList.add('role-board');
  } else {
    document.body.classList.add('role-member');
  }

  const roleLabel = document.body.classList.contains('role-board') ? currentUser.role : 'Medlem';
  document.getElementById('userChip').innerHTML =
    currentUser.name + ' <span class="role-badge">' + roleLabel + '</span>';

  if (document.body.classList.contains('role-member')) {
    showPaymentBanner(currentUser.payStatus, currentUser.payDue);
  }

  loadCalendar();
  loadNextMeeting();
  startAnslagstavlaPolling();
  showScreen('menu');
}

function showPaymentBanner(status, dueDate) {
  const banner = document.getElementById('paymentBanner');
  if (!banner) return;
  banner.classList.remove('hidden', 'green', 'yellow', 'red');
  if (status === 'green') {
    banner.classList.add('hidden');
  } else if (status === 'yellow') {
    banner.classList.add('yellow');
    banner.textContent = '⚠️ Din medlemsavgift förfaller ' + dueDate + ' – kom ihåg att betala!';
  } else {
    banner.classList.add('red');
    banner.textContent = '🔴 Din medlemsavgift är obetald. Kontakta kassören.';
  }
}

function logout() {
  google.accounts.oauth2.revoke(accessToken, () => {});
  currentUser = null;
  accessToken  = null;
  stopAnslagstavlaPolling();
  document.body.classList.remove('role-member', 'role-board');
  document.body.classList.add('role-member');
  document.getElementById('appShell').classList.add('hidden');
  document.getElementById('loginScreen').classList.remove('hidden');
  document.getElementById('loginError').textContent = '';
}

function showLoginError(msg) {
  document.getElementById('loginError').textContent = msg;
}

async function apiFetch(url, options = {}) {
  return fetch(url, {
    ...options,
    headers: {
      'Authorization': 'Bearer ' + accessToken,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
}

// Dynamically load GIS script then init
window.addEventListener('load', () => {
  const script = document.createElement('script');
  script.src = 'https://accounts.google.com/gsi/client';
  script.onload = () => {
    console.log('GIS loaded OK');
    initAuth();
  };
  script.onerror = (e) => {
    console.error('GIS failed to load:', e);
    showLoginError('Kunde inte ladda inloggningsbiblioteket. Kontrollera din internetanslutning.');
  };
  document.head.appendChild(script);
});
