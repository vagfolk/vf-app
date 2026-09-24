// -------------------------------------------------------
// CALENDAR.JS – Google Calendar integration
// -------------------------------------------------------

const MONTHS_SV = ['jan','feb','mar','apr','maj','jun','jul','aug','sep','okt','nov','dec'];
const DAYS_SV   = ['sön','mån','tis','ons','tor','fre','lör'];

async function loadCalendar() {
  try {
    const now    = new Date().toISOString();
    const future = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString();

    // Fetch from both calendars
    const [allEvents, boardEvents] = await Promise.all([
      fetchCalendarEvents(CALENDAR_ALL_ID, now, future),
      document.body.classList.contains('role-board')
        ? fetchCalendarEvents(CALENDAR_BOARD_ID, now, future)
        : Promise.resolve([])
    ]);

    // Merge and sort
    const events = [...allEvents, ...boardEvents.map(e => ({ ...e, boardOnly: true }))];
    events.sort((a, b) => new Date(a.start) - new Date(b.start));

    renderCalendar(events);
    renderNextMeeting(events);
  } catch (err) {
    console.error('Calendar error:', err);
    document.getElementById('calendarList').innerHTML = '<p class="loading">Kunde inte ladda kalender.</p>';
  }
}

async function fetchCalendarEvents(calendarId, timeMin, timeMax) {
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime&maxResults=20`;
  const res = await apiFetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.items || []).map(item => ({
    id:       item.id,
    title:    item.summary || '(Namnlöst möte)',
    start:    item.start?.dateTime || item.start?.date,
    location: item.location || '',
    boardOnly: false
  }));
}

function renderCalendar(events) {
  const el = document.getElementById('calendarList');
  if (!events.length) {
    el.innerHTML = '<p class="loading">Inga kommande möten.</p>';
    return;
  }
  el.innerHTML = events.map(e => {
    const d = new Date(e.start);
    const day = d.getDate();
    const mon = MONTHS_SV[d.getMonth()];
    const time = e.start.includes('T') ? d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }) : '';
    const tag  = e.boardOnly ? '<span class="event-tag">Endast styrelse</span>' : '';
    return `
      <div class="event">
        <div class="event-date">
          <div class="day">${day}</div>
          <div class="mon">${mon}</div>
        </div>
        <div class="event-body">
          <h3>${e.title}</h3>
          <p>${time ? time + ' · ' : ''}${e.location || ''}</p>
          ${tag}
        </div>
      </div>`;
  }).join('');
}

function renderNextMeeting(events) {
  if (!events.length) return;
  const next = events[0];
  const d = new Date(next.start);
  document.getElementById('nextMeetingName').textContent  = next.title;
  document.getElementById('nextMeetingPlace').textContent = next.location || '';
  document.getElementById('nextMeetingDay').textContent   = d.getDate();
  const mon = MONTHS_SV[d.getMonth()];
  const time = next.start.includes('T') ? d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }) : '';
  document.getElementById('nextMeetingMon').textContent   = mon + (time ? ' · ' + time : '');
}

// Fallback if calendar hasn't loaded yet when menu renders
function loadNextMeeting() {
  // loadCalendar() handles this – this is a no-op placeholder
}
