// -------------------------------------------------------
// DRIVE.JS – Google Drive file listing + Anslagstavla
// -------------------------------------------------------

let anslagstavlaTimer = null;
let anslagstavlaFileId = null;
let lastAnslagstavlaContent = '';

// ---- FILE LISTING ----

async function loadDriveFolder(folderId, targetEl) {
  try {
    const url = `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+trashed=false&fields=files(id,name,mimeType,modifiedTime,webViewLink)&orderBy=modifiedTime+desc`;
    const res  = await apiFetch(url);
    const data = await res.json();
    const files = data.files || [];

    if (!files.length) {
      targetEl.innerHTML = '<p class="loading">Inga filer i den här mappen.</p>';
      return;
    }

    targetEl.innerHTML = files.map(f => {
      const date = new Date(f.modifiedTime).toLocaleDateString('sv-SE');
      return `
        <a class="drive-file" href="${f.webViewLink}" target="_blank" rel="noopener">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="1.6">
            <path d="M6 3h9l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/>
            <line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="15.5" x2="16" y2="15.5"/>
          </svg>
          <div>
            <div class="drive-file-name">${f.name}</div>
            <div class="drive-file-date">Uppdaterad ${date}</div>
          </div>
        </a>`;
    }).join('');
  } catch (err) {
    console.error('Drive error:', err);
    targetEl.innerHTML = '<p class="loading">Kunde inte ladda filer.</p>';
  }
}

// Find a subfolder by name inside a parent folder
async function findSubfolder(parentId, name) {
  const url = `https://www.googleapis.com/drive/v3/files?q='${parentId}'+in+parents+and+name='${encodeURIComponent(name)}'+and+mimeType='application/vnd.google-apps.folder'+and+trashed=false&fields=files(id,name)`;
  const res  = await apiFetch(url);
  const data = await res.json();
  return (data.files || [])[0] || null;
}

// ---- PROTOKOLL / DOKUMENT ----

async function loadProtokoll() {
  const el = document.getElementById('protokollList');
  el.innerHTML = '<p class="loading">Laddar protokoll…</p>';
  const folder = await findSubfolder(DRIVE_ROOT_ID, 'protokoll');
  if (!folder) { el.innerHTML = '<p class="loading">Mappen "protokoll" hittades inte.</p>'; return; }
  await loadDriveFolder(folder.id, el);
}

async function loadDokument() {
  const el = document.getElementById('dokumentList');
  el.innerHTML = '<p class="loading">Laddar dokument…</p>';
  const folder = await findSubfolder(DRIVE_ROOT_ID, 'dokument');
  if (!folder) { el.innerHTML = '<p class="loading">Mappen "dokument" hittades inte.</p>'; return; }
  await loadDriveFolder(folder.id, el);
}

// ---- ANSLAGSTAVLA POLLING ----

async function getAnslagstavlaFileId() {
  if (anslagstavlaFileId) return anslagstavlaFileId;
  const folder = await findSubfolder(DRIVE_ROOT_ID, 'anslagstavla');
  if (!folder) return null;
  const url = `https://www.googleapis.com/drive/v3/files?q='${folder.id}'+in+parents+and+name='${ANSLAGSTAVLA_FILE}'+and+trashed=false&fields=files(id)`;
  const res  = await apiFetch(url);
  const data = await res.json();
  anslagstavlaFileId = (data.files || [])[0]?.id || null;
  return anslagstavlaFileId;
}

async function pollAnslagstavla() {
  try {
    const fileId = await getAnslagstavlaFileId();
    if (!fileId) return;
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    const res  = await apiFetch(url);
    const text = await res.text();
    if (text !== lastAnslagstavlaContent) {
      lastAnslagstavlaContent = text;
      renderAnslagstavla(text);
    }
  } catch (err) {
    // Silent – polling failure shouldn't crash app
  }
}

function renderAnslagstavla(text) {
  const lines   = text.split('\n').filter(l => l.trim());
  const el      = document.getElementById('boardMessages');
  if (!el) return;
  el.innerHTML  = lines.reverse().map(line => {
    // Format: ISO_TIMESTAMP|USER|urgent|MESSAGE
    const parts   = line.split('|');
    if (parts.length < 4) return '';
    const dateParts = parts[0].split(' ');
    const timeStr = dateParts[1] || parts[0];
    const user    = parts[1];
    const urgent  = parts[2] === '1';
    const msg     = parts.slice(3).join('|');
    const isMe    = window.currentUser && user === window.currentUser.name;
    const urgentTag = urgent ? ' <span class="urgent-tag">Behöver hjälp</span>' : '';
    return `
      <div class="msg${urgent ? ' urgent' : ''}${isMe ? ' me' : ''}">
        <div class="meta">${user} · ${timeStr}${urgentTag}</div>
        <div class="bubble">${msg}</div>
      </div>`;
  }).join('');
}

async function appendToAnslagstavla(message, urgent) {
  try {
    // Read current content
    const fileId = await getAnslagstavlaFileId();
    if (!fileId) { alert('Anslagstavlan är inte uppsatt än.'); return; }

    const now  = new Date();
    const ts   = now.getFullYear() + '-'
      + String(now.getMonth()+1).padStart(2,'0') + '-'
      + String(now.getDate()).padStart(2,'0') + ' '
      + String(now.getHours()).padStart(2,'0') + ':'
      + String(now.getMinutes()).padStart(2,'0');
    const name = (window.currentUser && window.currentUser.name) ? window.currentUser.name : 'Okänd';
    const line = ts + '|' + name + '|' + (urgent ? '1' : '0') + '|' + message + '\n';

    // Append by downloading, appending, re-uploading
    const getRes = await apiFetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`);
    const current = await getRes.text();
    const updated = current + line;

    await apiFetch(
      `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
      { method: 'PATCH', headers: { 'Content-Type': 'text/plain' }, body: updated }
    );

    // Update local immediately
    lastAnslagstavlaContent = updated;
    renderAnslagstavla(updated);
  } catch (err) {
    console.error('Anslagstavla write error:', err);
    alert('Kunde inte posta meddelandet. Kontrollera uppkopplingen.');
  }
}

function startAnslagstavlaPolling() {
  pollAnslagstavla();
  anslagstavlaTimer = setInterval(pollAnslagstavla, ANSLAGSTAVLA_POLL_INTERVAL);
}

function stopAnslagstavlaPolling() {
  if (anslagstavlaTimer) { clearInterval(anslagstavlaTimer); anslagstavlaTimer = null; }
  anslagstavlaFileId = null;
  lastAnslagstavlaContent = '';
}
