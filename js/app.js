// -------------------------------------------------------
// APP.JS – Screen navigation, UI logic, user interactions
// -------------------------------------------------------

let protokollLoaded = false;
let dokumentLoaded  = false;

// ---- SCREEN NAVIGATION ----

function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById('screen-' + name);
  if (target) target.classList.add('active');

  // Lazy-load data when screen is opened
  if (name === 'protokoll') {
    if (!protokollLoaded) { loadProtokoll(); protokollLoaded = true; }
    showProtokollTab('mp');
  }
  if (name === 'kassa') loadKassa();
  if (name === 'todo')  loadTodo();
  if (name === 'mote')  loadMote();
}

function showProtokollTab(name) {
  document.getElementById('ppane-mp').classList.toggle('on', name === 'mp');
  document.getElementById('ppane-dok').classList.toggle('on', name === 'dok');
  document.getElementById('ptab-mp').classList.toggle('on', name === 'mp');
  document.getElementById('ptab-dok').classList.toggle('on', name === 'dok');
  if (name === 'dok' && !dokumentLoaded) { loadDokument(); dokumentLoaded = true; }
}

// ---- KASSA ----

async function loadKassa() {
  if (document.body.classList.contains('role-board')) {
    loadKassaBoard();
  } else {
    loadKassaMember();
  }
}

async function loadKassaMember() {
  const el = document.getElementById('memberPayStatus');
  if (!currentUser) return;
  const s = currentUser.payStatus;
  const label = s === 'green' ? 'Betald ✓' : s === 'yellow' ? 'Förfaller snart ⚠️' : 'Obetald ✗';
  const due   = currentUser.payDue ? 'Nästa förfallodatum: ' + currentUser.payDue : '';
  el.innerHTML = `
    <div class="pay-status-panel ${s}">
      <div class="pay-status-label">Betalstatus</div>
      <div class="pay-status-val ${s}">${label}</div>
      <div class="pay-status-sub">${due}</div>
    </div>
    <p style="font-size:12.5px;color:var(--muted);line-height:1.6;">
      Föreningens saldo och transaktioner hanteras av kassören.
    </p>`;
}

async function loadKassaBoard() {
  // Reads summary from VF-EKO Sheets
  const el = document.getElementById('kassabokBoard');
  el.innerHTML = '<p class="loading">Laddar kassabok…</p>';
  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEETS_VFEKO_ID}/values/Kassabok!A1:Z5`;
    const res  = await apiFetch(url);
    const data = await res.json();
    // Show raw data as placeholder until we know exact cell layout
    el.innerHTML = `
      <div class="balance-panel">
        <div class="balance-label">Kassabok</div>
        <div class="balance-num" style="font-size:20px;">Öppna i Google Sheets</div>
        <div class="balance-sub">Klicka nedan för att redigera</div>
      </div>
      <a class="drive-file" href="https://docs.google.com/spreadsheets/d/${SHEETS_VFEKO_ID}/edit" target="_blank" rel="noopener">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="1.6">
          <path d="M6 3h9l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/>
          <line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="15.5" x2="16" y2="15.5"/>
        </svg>
        <div>
          <div class="drive-file-name">VF-EKO – Kassabok</div>
          <div class="drive-file-date">Öppnar Google Sheets</div>
        </div>
      </a>`;
  } catch (err) {
    el.innerHTML = '<p class="loading">Kunde inte ladda kassabok.</p>';
  }
}

// ---- TODO ----

async function loadTodo() {
  // Load from Drive todo/ folder
  const folder = await findSubfolder(DRIVE_ROOT_ID, 'todo');
  if (!folder) return;

  if (document.body.classList.contains('role-board')) {
    const boardEl = document.getElementById('todoBoard');
    const boardFolder = await findSubfolder(folder.id, 'styrelse');
    if (boardFolder) loadDriveFolder(boardFolder.id, boardEl);
  }

  const memberEl = document.getElementById('todoMember');
  const memberFolder = await findSubfolder(folder.id, 'medlem');
  if (memberFolder) loadDriveFolder(memberFolder.id, memberEl);
}

// ---- MÖTESLÄGE ----

async function loadMote() {
  // Load agenda from Drive moteslagen/ folder
  const el   = document.getElementById('agendaList');
  const sub  = document.getElementById('moteSub');
  const curr = document.getElementById('agendaCurrent');

  const folder = await findSubfolder(DRIVE_ROOT_ID, 'moteslagen');
  if (!folder) {
    sub.textContent = 'Inget aktivt möte just nu.';
    return;
  }

  // List files, pick the latest
  const url  = `https://www.googleapis.com/drive/v3/files?q='${folder.id}'+in+parents+and+trashed=false&fields=files(id,name,webViewLink,modifiedTime)&orderBy=modifiedTime+desc`;
  const res  = await apiFetch(url);
  const data = await res.json();
  const files = data.files || [];

  if (!files.length) {
    sub.textContent = 'Inga dagordningar uppladdade ännu.';
    return;
  }

  sub.textContent = files[0].name;

  // Show file list
  el.innerHTML = files.map(f => `
    <a class="drive-file" href="${f.webViewLink}" target="_blank" rel="noopener">
      <svg viewBox="0 0 24 24" fill="none" stroke-width="1.6">
        <path d="M6 3h9l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/>
        <line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="15.5" x2="16" y2="15.5"/>
      </svg>
      <div>
        <div class="drive-file-name">${f.name}</div>
        <div class="drive-file-date">Senast ändrad: ${new Date(f.modifiedTime).toLocaleDateString('sv-SE')}</div>
      </div>
    </a>`).join('');

  // Show board controls if board role
  if (document.body.classList.contains('role-board')) {
    document.getElementById('boardControls').style.display = 'block';
  }
}

// ---- ATTENDANCE ----

function toggleAttendance() {
  const box = document.getElementById('attendanceBox');
  const isHidden = box.classList.contains('hidden');
  box.classList.toggle('hidden');
  if (isHidden) {
    // In real app: fetch who's logged in from Drive presence file
    // For now show current user as placeholder
    document.getElementById('attendanceCount').textContent = '1 INLOGGAD JUST NU';
    document.getElementById('attendanceList').innerHTML =
      '<div class="todo-item done"><div class="todo-box"></div><div class="todo-text">' +
      (currentUser?.name || 'Du') + '</div></div>';
  }
}

// ---- ANSLAGSTAVLA ACTIONS ----

function postMessage(text) {
  const urgent = text === 'Behöver hjälp';
  appendToAnslagstavla(text, urgent);
}

function postCustomMessage() {
  const input = document.getElementById('boardInput');
  const text  = input.value.trim();
  if (!text) return;
  appendToAnslagstavla(text, false);
  input.value = '';
}

// ---- ONLINE COUNT (placeholder – real impl needs presence file on Drive) ----
// Updates every 60 seconds
setInterval(() => {
  const el = document.getElementById('onlineCount');
  if (el && currentUser) el.textContent = '1 inloggad';
}, 60000);
