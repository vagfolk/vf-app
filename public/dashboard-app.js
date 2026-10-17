const appState = { user: null, fee: null, boardSummary: null, connection: 'checking' };
let boardRequestId = 0;
let activeView = 'start';
document.documentElement.classList.toggle('phone-device', /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent));

async function readApi(path, options = {}) {
  const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store', ...options });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

function updateDashboard() {
  window.VFDashboard?.setData(appState);
}

async function loadBoardSummary() {
  const requestId = ++boardRequestId;
  appState.boardSummary = null;
  window.VFDashboard?.refresh();
  try {
    appState.user = await readApi('/api/me');
    if (requestId !== boardRequestId) return;
    if (!appState.user.permissions.includes('board_view')) {
      updateDashboard();
      document.dispatchEvent(new CustomEvent('vf:navigate', { detail: { id: 'start' } }));
      return;
    }
    updateDashboard();
    const summary = await readApi('/api/board-summary');
    if (requestId !== boardRequestId) return;
    appState.boardSummary = summary;
  } catch (error) {
    if (requestId !== boardRequestId) return;
    if (error.message === 'HTTP 401') {
      location.replace('/');
      return;
    }
    appState.boardSummary = { error: true };
  }
  window.VFDashboard?.refresh();
}

document.addEventListener('vf:view-selected', event => {
  activeView = event.detail.id;
  if (activeView === 'board') loadBoardSummary();
  else {
    ++boardRequestId;
    appState.boardSummary = null;
  }
});

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && activeView === 'board') loadBoardSummary();
});

document.addEventListener('vf:signout', async () => {
  try {
    await readApi('/api/signout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    location.replace('/');
  } catch {
    const notice = document.querySelector('.app-notice');
    if (notice) notice.textContent = 'Utloggningen misslyckades. Försök igen.';
  }
});

document.addEventListener('vf:dashboard-ready', async () => {
  window.VFDashboard.startStartup?.();
  window.VFDashboard.authorizeView = async view => {
    const result = await readApi(`/api/view-access?view=${encodeURIComponent(view)}`);
    if (typeof result.allowed !== 'boolean' || !result.profile) throw new Error('Ogiltigt behörighetssvar');
    appState.user = result.profile;
    updateDashboard();
    return result.allowed;
  };
  try {
    [appState.user, appState.fee] = await Promise.all([readApi('/api/me'), readApi('/api/my-fee')]);
    appState.connection = 'connected';
    updateDashboard();
  } catch (error) {
    if (error.message === 'HTTP 401') {
      location.replace('/');
      return;
    }
    appState.connection = error.message === 'HTTP 404' ? 'unavailable' : 'error';
    updateDashboard();
    const notice = document.querySelector('.app-notice');
    if (notice) notice.textContent = 'Dina uppgifter kunde inte hämtas. Ladda om sidan eller försök senare.';
  }
});
