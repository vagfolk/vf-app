// -------------------------------------------------------
// AUTH.JS – Google OAuth + rollstyrning via VF-EKO
// -------------------------------------------------------

let currentUser = null; // { name, email, role, payStatus, payDue }
let accessToken  = null;

// Called automatically by Google's GSI library when page loads
function initGoogleSignIn() {
  google.accounts.id.initialize({
    client_id: CLIENT_ID,
    callback: handleCredentialResponse,
    auto_select: false
  });
  google.accounts.id.renderButton(
    document.getElementById('googleSignInBtn'),
    { theme: 'outline', size: 'large', text: 'signin_with', locale: 'sv' }
  );
}

// Called when user completes Google sign-in
async function handleCredentialResponse(response) {
  try {
    // Decode JWT to get basic user info (name, email)
    const payload = parseJwt(response.credential);

    // Request an access token for API calls (Drive, Sheets, Calendar)
    const tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: async (tokenResponse) => {
        if (tokenResponse.error) {
          showLoginError('Kunde inte hämta åtkomst. Försök igen.');
          return;
        }
        accessToken = tokenResponse.access_token;

        // Look up the user in VF-EKO Sheets
        const member = await lookupMember(payload.email);
        if (!member) {
          showLoginError('Du verkar inte vara registrerad medlem. Kontakta styrelsen.');
          return;
        }

        currentUser = {
          name: payload.name || member.namn || payload.email,
          email: payload.email,
          role: member.approll || 'Medlem',
          payStatus: member.payStatus,
          payDue: member.payDue
        };

        onLoginSuccess();
      }
    });
    tokenClient.requestAccessToken({ prompt: 'consent' });

  } catch (err) {
    console.error('Auth error:', err);
    showLoginError('Inloggning misslyckades. Försök igen.');
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

// Init Google Sign-In once GSI library is ready
window.addEventListener('load', () => {
  const check = setInterval(() => {
    if (window.google && google.accounts) {
      clearInterval(check);
      initGoogleSignIn();
    }
  }, 100);
});
