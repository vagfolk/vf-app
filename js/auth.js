// -------------------------------------------------------
// AUTH.JS – Google OAuth + rollstyrning via VF-EKO
// -------------------------------------------------------

let currentUser = null;
let accessToken  = null;

// Build the Google OAuth URL and redirect
function startGoogleLogin() {
  const params = new URLSearchParams({
    client_id:     CLIENT_ID,
    redirect_uri:  window.location.origin + window.location.pathname,
    response_type: 'token',
    scope:         SCOPES,
    prompt:        'select_account'
  });
  window.location.href = 'https://accounts.google.com/o/oauth2/v2/auth?' + params.toString();
}

// On page load – check if we're returning from Google with a token in the URL hash
async function checkOAuthReturn() {
  const hash   = window.location.hash.substring(1);
  const params = new URLSearchParams(hash);
  const token  = params.get('access_token');
  if (!token) return false;

  // Clean the token from the URL
  history.replaceState(null, '', window.location.pathname);

  accessToken = token;

  // Get user info from Google
  try {
    const res  = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const info = await res.json();

    // Look up in VF-EKO
    const member = await lookupMember(info.email);
    if (!member) {
      showLoginError('Du verkar inte vara registrerad medlem. Kontakta styrelsen.');
      accessToken = null;
      return true;
    }

    currentUser = {
      name:      info.name || member.namn || info.email,
      email:     info.email,
      role:      member.approll || 'Medlem',
      payStatus: member.payStatus,
      payDue:    member.payDue
    };
    onLoginSuccess();
    return true;
  } catch (err) {
    console.error('Auth error:', err);
    showLoginError('Inloggning misslyckades. Försök igen.');
    return true;
  }
}

// Look up email in VF-EKO Medlemmar sheet
async function lookupMember(email) {
  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEETS_VFEKO_ID}/values/${SHEET_MEMBERS_TAB}!A1:Z300`;
    const res = await apiFetch(url);
    const data = await res.json();
    const rows = data.values || [];
    if (rows.length < 2) return null;

    // Find header row (row with 'E-POST')
    let headerIdx = -1;
    let colEmail = -1, colNamn = -1, colApproll = -1, colBetalat = -1, colForfall = -1, colRadstatus = -1;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i].map(v => (v || '').toString().trim().toUpperCase().replace(/[\n\r\s]+/g, ' '));
      if (row.includes('E-POST')) {
        headerIdx = i;
        colEmail     = row.indexOf('E-POST');
        colNamn      = row.indexOf('NAMN');
        colApproll   = row.indexOf('APPROLL');
        colBetalat   = row.indexOf('BETALAT');
        colForfall   = row.findIndex(h => h.includes('BETALD') && h.includes('DATUM'));
        colRadstatus = row.indexOf('RADSTATUS');
        break;
      }
    }
    if (headerIdx === -1) return null;

    // Search data rows
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      const rowEmail = (row[colEmail] || '').trim().toLowerCase();
      if (rowEmail === email.toLowerCase()) {
        // Skip inactive rows
        const status = (row[colRadstatus] || '').trim().toLowerCase();
        if (status === 'inaktiv' || status === 'borttagen') return null;

        const betalat  = (row[colBetalat] || '').trim().toLowerCase() === 'ja';
        const forfallStr = (row[colForfall] || '').trim();
        const payDue   = forfallStr ? new Date(forfallStr) : null;

        // Determine payment status
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
    return null;
  } catch (err) {
    console.error('Member lookup error:', err);
    return null;
  }
}

function onLoginSuccess() {
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('appShell').classList.remove('hidden');

  // Set role class on body
  const role = currentUser.role.toLowerCase();
  document.body.classList.remove('role-member', 'role-board');
  if (role.includes('styrelse') || role.includes('kassör') || role.includes('sekreterare')) {
    document.body.classList.add('role-board');
  } else {
    document.body.classList.add('role-member');
  }

  // Status bar
  const roleLabel = document.body.classList.contains('role-board') ? currentUser.role : 'Medlem';
  document.getElementById('userChip').innerHTML =
    currentUser.name + ' <span class="role-badge">' + roleLabel + '</span>';

  // Payment banner (members only, board always has access)
  if (document.body.classList.contains('role-member')) {
    showPaymentBanner(currentUser.payStatus, currentUser.payDue);
  }

  // Load initial data
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
    banner.classList.add('hidden'); // no banner if all good
  } else if (status === 'yellow') {
    banner.classList.add('yellow');
    banner.textContent = '⚠️ Din medlemsavgift förfaller ' + dueDate + ' – kom ihåg att betala!';
  } else {
    banner.classList.add('red');
    banner.textContent = '🔴 Din medlemsavgift är obetald. Kontakta kassören.';
  }
}

function logout() {
  google.accounts.id.disableAutoSelect();
  currentUser = null;
  accessToken  = null;
  stopAnslagstavlaPolling();
  document.body.classList.remove('role-member', 'role-board');
  document.body.classList.add('role-member');
  document.getElementById('appShell').classList.add('hidden');
  document.getElementById('loginScreen').classList.remove('hidden');
  document.getElementById('loginError').textContent = '';
}

// ---- Helpers ----
function showLoginError(msg) {
  document.getElementById('loginError').textContent = msg;
}

function parseJwt(token) {
  const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(decodeURIComponent(atob(base64).split('').map(c =>
    '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')));
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

// On page load – check for OAuth return, otherwise show login button
window.addEventListener('load', async () => {
  const wasReturn = await checkOAuthReturn();
  if (!wasReturn) {
    // Show login button
    const btn = document.getElementById('googleSignInBtn');
    if (btn) {
      btn.innerHTML = '<button onclick="startGoogleLogin()" style="display:flex;align-items:center;gap:10px;padding:12px 20px;border:1px solid #dadce0;border-radius:6px;background:#fff;cursor:pointer;font-family:inherit;font-size:15px;font-weight:500;color:#3c4043;"><svg width=18 height=18 viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/><path fill="none" d="M0 0h48v48H0z"/></svg>Logga in med Google</button>';
    }
  }
});
