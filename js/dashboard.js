/* Dashboard — the Overview tab: countdown, weekly goals & streak, follow-ups due,
   pipeline tiles, recent activity. */

const Dashboard = {
  OUTREACH_TYPES: ['outreach', 'coffee-chat', 'call', 'email', 'referral', 'meeting', 'other'],

  adviceCardHtml() {
    const items = Store.state.meetings
      .filter(m => m.debrief && m.debrief.advice && !m.debrief.adviceDone)
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    if (!items.length) return '';
    return `<div class="card section-gap">
      <h2>Advice to act on</h2>
      <p class="muted small" style="margin:0 0 4px">Acting on advice — then telling the person you did — is the strongest follow-up you can send.</p>
      <ul class="item-list">
        ${items.map(m => `<li>
          <span class="grow">"${escapeHtml(m.debrief.advice)}"<br>
            <span class="muted small">— ${escapeHtml(Meetings.personLabel(m))}, ${fmtDate(m.date)}</span></span>
          <button class="tiny" data-advice-done="${m.id}">Acted on it ✓</button>
        </li>`).join('')}
      </ul>
    </div>`;
  },

  upcomingMeetings() {
    const t = todayISO(), horizon = addDaysISO(t, 7);
    return Store.state.meetings
      .filter(m => !m.done && m.date && m.date >= t && m.date <= horizon)
      .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))
      .slice(0, 6);
  },

  weekCounts(weekStart) {
    const weekEnd = addDaysISO(weekStart, 6);
    const inWeek = d => d && d >= weekStart && d <= weekEnd;
    const apps = Store.state.applications.filter(a => inWeek(a.appliedDate)).length;
    const outreach = Store.state.activities.filter(a => a.contactId && this.OUTREACH_TYPES.includes(a.type) && inWeek(a.date)).length;
    return { apps, outreach };
  },

  streak() {
    const g = Store.state.settings.weeklyGoals;
    const thisWeek = weekStartISO(todayISO());
    let streak = 0;
    // Current week counts toward the streak only once it's already hit.
    const cur = this.weekCounts(thisWeek);
    if (cur.apps >= g.applications && cur.outreach >= g.outreach) streak++;
    let w = addDaysISO(thisWeek, -7);
    const firstWeek = weekStartISO(Store.state.settings.startDate);
    while (w >= firstWeek) {
      const c = this.weekCounts(w);
      if (c.apps >= g.applications && c.outreach >= g.outreach) { streak++; w = addDaysISO(w, -7); }
      else break;
    }
    return streak;
  },

  followUps() {
    const t = todayISO();
    const contacts = Store.state.contacts
      .filter(c => c.nextTouchDate && c.nextTouchDate <= t)
      .sort((a, b) => a.nextTouchDate.localeCompare(b.nextTouchDate));
    const apps = Store.state.applications
      .filter(a => a.followUpDate && a.followUpDate <= t && !['offer', 'rejected'].includes(a.status))
      .sort((a, b) => a.followUpDate.localeCompare(b.followUpDate));
    const tasks = Store.state.tasks
      .filter(x => !x.done && x.dueDate && x.dueDate <= t)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    return { contacts, apps, tasks };
  },

  render() {
    const el = document.getElementById('tab-overview');
    const s = Store.state.settings;
    const t = todayISO();
    const totalDays = Math.max(1, daysBetween(s.startDate, s.endDate));
    const dayNum = Math.min(totalDays, Math.max(1, daysBetween(s.startDate, t) + 1));
    const daysLeft = Math.max(0, daysBetween(t, s.endDate));
    const g = s.weeklyGoals;
    const week = this.weekCounts(weekStartISO(t));
    const streak = this.streak();
    const due = this.followUps();
    const counts = {};
    Pipeline.STATUSES.forEach(st => counts[st] = Store.state.applications.filter(a => a.status === st).length);
    const feed = Store.state.activities.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 8);

    const pct = (n, goal) => Math.min(100, Math.round((n / Math.max(1, goal)) * 100));

    el.innerHTML = `
      <div class="card section-gap">
        <div class="hero">
          <span class="big">${daysLeft}</span>
          <span class="caption">days left · day ${dayNum} of ${totalDays} · ends ${fmtDate(s.endDate)}</span>
        </div>
        <div class="meter thin" style="margin-top:12px"><span style="width:${Math.round((dayNum / totalDays) * 100)}%"></span></div>
      </div>

      <div class="grid grid-2 section-gap">
        <div class="card">
          <h2>This week</h2>
          <div class="goal-line"><span>Applications</span><span><span class="num">${week.apps}</span> / ${g.applications}</span></div>
          <div class="meter ${week.apps >= g.applications ? 'met' : ''}"><span style="width:${pct(week.apps, g.applications)}%"></span></div>
          <div class="goal-line" style="margin-top:14px"><span>Outreach touches</span><span><span class="num">${week.outreach}</span> / ${g.outreach}</span></div>
          <div class="meter ${week.outreach >= g.outreach ? 'met' : ''}"><span style="width:${pct(week.outreach, g.outreach)}%"></span></div>
          <p class="muted small" style="margin-bottom:0">Streak: <b style="color:var(--ink)">${streak}</b> week${streak === 1 ? '' : 's'} hitting both goals${streak >= 2 ? ' 🔥' : ''} · weeks run Mon–Sun · goals editable in Settings</p>
        </div>
        <div class="card">
          <h2>Follow-ups due ${due.contacts.length + due.apps.length + due.tasks.length ? `<span class="overdue">(${due.contacts.length + due.apps.length + due.tasks.length})</span>` : ''}</h2>
          ${(!due.contacts.length && !due.apps.length && !due.tasks.length) ? '<div class="empty-state">Nothing due. Set "next touch" dates on contacts, follow-up dates on applications, or due dates on tasks to see them here.</div>' : ''}
          <ul class="item-list">
            ${due.contacts.map(c => `<li>
              <span class="grow"><span class="who">${escapeHtml(contactName(c))}</span>
                <span class="muted small">${escapeHtml(c.company || '')}</span><br>
                <span class="${c.nextTouchDate < t ? 'overdue' : 'due-today'}">${c.nextTouchDate < t ? 'overdue since ' + fmtDate(c.nextTouchDate) : 'due today'}</span></span>
              <button class="tiny" data-touch="${c.id}">Log touch</button>
              <button class="ghost tiny" data-open-contact="${c.id}">Open</button>
            </li>`).join('')}
            ${due.apps.map(a => `<li>
              <span class="grow"><span class="who">${escapeHtml(a.company)}</span>
                <span class="muted small">${escapeHtml(a.role)}</span><br>
                <span class="${a.followUpDate < t ? 'overdue' : 'due-today'}">follow up ${a.followUpDate < t ? '· overdue since ' + fmtDate(a.followUpDate) : '· due today'}</span></span>
              <button class="tiny" data-app-done="${a.id}">Done</button>
              <button class="ghost tiny" data-open-app="${a.id}">Open</button>
            </li>`).join('')}
            ${due.tasks.map(x => `<li>
              <span class="grow"><span class="who">${escapeHtml(x.text)}</span><br>
                <span class="${x.dueDate < t ? 'overdue' : 'due-today'}">task ${x.dueDate < t ? '· overdue since ' + fmtDate(x.dueDate) : '· due today'}</span></span>
              <button class="tiny" data-task-done="${x.id}">Done</button>
            </li>`).join('')}
          </ul>
        </div>
      </div>

      ${this.adviceCardHtml()}

      <div class="card section-gap">
        <h2>Upcoming meetings</h2>
        ${this.upcomingMeetings().length ? `<ul class="item-list">
          ${this.upcomingMeetings().map(m => `<li>
            <span class="grow">
              <span class="who">${escapeHtml(Meetings.personLabel(m))}</span>
              <span class="muted">· ${Meetings.TYPE_LABELS[m.type] || m.type}</span><br>
              <span class="muted small">${m.date === todayISO() ? 'Today' : parseISO(m.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} · ${fmtTime(m.time)}${m.location ? ' · ' + escapeHtml(m.location) : ''}</span>
            </span>
            ${Meetings.prepBadge(m)}
            <button class="ghost tiny" data-open-meeting="${m.id}">Open</button>
          </li>`).join('')}
        </ul>` : '<div class="empty-state">No meetings in the next 7 days. Add upcoming coffee chats and screens in the Calendar tab.</div>'}
      </div>

      <div class="tile-row section-gap">
        ${Pipeline.STATUSES.map(st => `
          <div class="stat-tile">
            <div class="label">${Pipeline.LABELS[st]}</div>
            <div class="value">${counts[st]}</div>
          </div>`).join('')}
        <div class="stat-tile">
          <div class="label">Contacts</div>
          <div class="value">${Store.state.contacts.length}</div>
        </div>
      </div>

      <div class="card">
        <h2>Recent activity</h2>
        ${feed.length ? `<ul class="item-list">${feed.map(a => {
          const c = Store.state.contacts.find(x => x.id === a.contactId);
          const app = Store.state.applications.find(x => x.id === a.applicationId);
          const label = a.type === 'application' && app ? escapeHtml(a.notes || ('Applied: ' + app.company))
            : escapeHtml(a.type) + (c ? ' · <span class="who">' + escapeHtml(contactName(c)) + '</span>' : '') + (a.notes ? ' — <span class="muted">' + escapeHtml(a.notes) + '</span>' : '');
          return `<li><span class="grow">${label}</span><span class="feed-time">${fmtDate(a.date)}</span></li>`;
        }).join('')}</ul>` : '<div class="empty-state">Activity you log — outreach, applications, chats — shows up here.</div>'}
      </div>
    `;

    // Follow-up actions
    el.querySelectorAll('[data-touch]').forEach(b => b.addEventListener('click', () => {
      const c = Store.state.contacts.find(x => x.id === b.dataset.touch);
      Store.state.activities.push({ id: Store.uid(), contactId: c.id, type: 'outreach', date: todayISO(), notes: 'Logged from Overview' });
      c.nextTouchDate = addDaysISO(todayISO(), 14); // keep the relationship on a cadence
      Store.save(); App.render();
      App.flash('Touch logged for ' + contactName(c) + ' — next touch in 2 weeks.');
    }));
    el.querySelectorAll('[data-app-done]').forEach(b => b.addEventListener('click', () => {
      const a = Store.state.applications.find(x => x.id === b.dataset.appDone);
      a.followUpDate = null;
      Store.save(); App.render();
    }));
    el.querySelectorAll('[data-task-done]').forEach(b => b.addEventListener('click', () => {
      const x = Store.state.tasks.find(k => k.id === b.dataset.taskDone);
      x.done = true; x.doneAt = todayISO();
      Store.save(); App.render();
    }));
    el.querySelectorAll('[data-open-contact]').forEach(b => b.addEventListener('click', () => {
      Contacts.ui.selectedId = b.dataset.openContact;
      App.setTab('contacts');
    }));
    el.querySelectorAll('[data-open-app]').forEach(b => b.addEventListener('click', () => {
      Pipeline.ui.selectedId = b.dataset.openApp;
      App.setTab('pipeline');
    }));
    el.querySelectorAll('[data-advice-done]').forEach(b => b.addEventListener('click', () => {
      const m = Store.state.meetings.find(x => x.id === b.dataset.adviceDone);
      m.debrief.adviceDone = true;
      const contact = Store.state.contacts.find(c => c.id === m.contactId);
      if (contact) contact.nextTouchDate = todayISO();
      Store.save(); App.render();
      App.flash(contact
        ? 'Nice. Tell ' + contactName(contact) + ' you did it — follow-up due today.'
        : 'Nice — advice checked off.');
    }));
    el.querySelectorAll('[data-open-meeting]').forEach(b => b.addEventListener('click', () => {
      const m = Store.state.meetings.find(x => x.id === b.dataset.openMeeting);
      Meetings.ui.selectedId = m.id;
      Meetings.ui.weekStart = weekStartISO(m.date);
      App.setTab('calendar');
    }));
  }
};
