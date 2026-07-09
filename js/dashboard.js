/* Dashboard — the Overview tab: countdown, weekly goals & streak, follow-ups due,
   pipeline tiles, recent activity. */

const Dashboard = {
  OUTREACH_TYPES: ['outreach', 'coffee-chat', 'call', 'email', 'referral', 'meeting', 'informational', 'other'],

  hillLineHtml() {
    const n = Store.state.hillTargets.filter(t => t.status === 'ready').length;
    if (!n) return '';
    return `<div class="card section-gap hill-line">
      <span class="grow">🏛️ <b>${n}</b> Hill narrative${n === 1 ? '' : 's'} ready to send to the liaison.</span>
      <button class="tiny" id="ov-open-hill">Open Hill tab</button>
    </div>`;
  },

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
    const infos = Store.state.activities.filter(a => a.contactId && a.type === 'informational' && inWeek(a.date)).length;
    return { apps, outreach, infos };
  },

  goalsMet(c, g) {
    return c.apps >= g.applications && c.outreach >= g.outreach && c.infos >= (g.informationals || 0);
  },

  streak() {
    const g = Store.state.settings.weeklyGoals;
    const thisWeek = weekStartISO(todayISO());
    let streak = 0;
    // Current week counts toward the streak only once it's already hit.
    if (this.goalsMet(this.weekCounts(thisWeek), g)) streak++;
    let w = addDaysISO(thisWeek, -7);
    const firstWeek = weekStartISO(Store.state.settings.startDate);
    while (w >= firstWeek) {
      if (this.goalsMet(this.weekCounts(w), g)) { streak++; w = addDaysISO(w, -7); }
      else break;
    }
    return streak;
  },

  /* Outreach → informational → meeting → referral over the trailing 4 weeks —
     the conversion signal that says whether the strategy is working. */
  funnel() {
    const from = addDaysISO(todayISO(), -28);
    const acts = Store.state.activities.filter(a => a.date && a.date >= from);
    return {
      touches: acts.filter(a => a.contactId && this.OUTREACH_TYPES.includes(a.type)).length,
      infos: acts.filter(a => a.type === 'informational').length,
      meetings: Store.state.meetings.filter(m => m.done && m.date && m.date >= from).length,
      referrals: acts.filter(a => a.type === 'referral').length
    };
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
    const horizon = addDaysISO(t, 7);
    const deadlines = Store.state.applications
      .filter(a => a.deadline && a.deadline <= horizon && !['applied', 'offer', 'rejected'].includes(a.status))
      .sort((a, b) => a.deadline.localeCompare(b.deadline));
    return { contacts, apps, tasks, deadlines };
  },

  /* Countdown card: a segmented phase timeline when phases are defined,
     else the original single start→end bar. */
  countdownCardHtml(s, t) {
    const phases = (s.phases || []).filter(p => p.start && p.end);
    if (!phases.length) {
      const totalDays = Math.max(1, daysBetween(s.startDate, s.endDate));
      const dayNum = Math.min(totalDays, Math.max(1, daysBetween(s.startDate, t) + 1));
      const daysLeft = Math.max(0, daysBetween(t, s.endDate));
      return `<div class="card section-gap">
        <div class="hero">
          <span class="big">${daysLeft}</span>
          <span class="caption">days left · day ${dayNum} of ${totalDays} · ends ${fmtDate(s.endDate)}</span>
        </div>
        <div class="meter thin" style="margin-top:12px"><span style="width:${Math.round((dayNum / totalDays) * 100)}%"></span></div>
      </div>`;
    }
    const cp = currentPhase();
    const last = phases[phases.length - 1];
    const totalSpan = Math.max(1, daysBetween(phases[0].start, last.end));
    let hero;
    if (cp) {
      const left = Math.max(0, daysBetween(t, cp.phase.end));
      hero = `<span class="big">${left}</span>
        <span class="caption">days left in <b style="color:var(--ink)">${escapeHtml(cp.phase.name)}</b> · phase ${cp.idx + 1} of ${cp.total} · plan runs through ${fmtDate(last.end)}</span>`;
    } else if (t < phases[0].start) {
      hero = `<span class="big">${daysBetween(t, phases[0].start)}</span>
        <span class="caption">days until the plan starts (${escapeHtml(phases[0].name)}, ${fmtDate(phases[0].start)})</span>`;
    } else {
      hero = `<span class="big">0</span><span class="caption">plan complete — last phase ended ${fmtDate(last.end)}</span>`;
    }
    return `<div class="card section-gap">
      <div class="hero">${hero}</div>
      <div class="phase-strip">
        ${phases.map(p => {
          const span = Math.max(1, daysBetween(p.start, p.end) + 1);
          const w = Math.max(8, Math.round((span / totalSpan) * 100));
          const state = t > p.end ? 'past' : (t >= p.start ? 'current' : 'future');
          const fill = state === 'past' ? 100 : state === 'future' ? 0
            : Math.round(((daysBetween(p.start, t) + 1) / span) * 100);
          return `<div class="phase-seg ${state}" style="flex:${w}" title="${escapeHtml(p.name)} · ${fmtDate(p.start)} – ${fmtDate(p.end)}">
            <div class="phase-name">${escapeHtml(p.name)}</div>
            <div class="phase-bar"><span style="width:${fill}%"></span></div>
            <div class="phase-dates">${fmtDate(p.start)} – ${fmtDate(p.end)}</div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  },

  render() {
    const el = document.getElementById('tab-overview');
    const s = Store.state.settings;
    const t = todayISO();
    const g = s.weeklyGoals;
    const week = this.weekCounts(weekStartISO(t));
    const streak = this.streak();
    const due = this.followUps();
    const counts = {};
    Pipeline.STATUSES.forEach(st => counts[st] = Store.state.applications.filter(a => a.status === st).length);
    const feed = Store.state.activities.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 8);

    const pct = (n, goal) => Math.min(100, Math.round((n / Math.max(1, goal)) * 100));
    const fn = this.funnel();

    el.innerHTML = `
      ${this.countdownCardHtml(s, t)}

      <div class="grid grid-2 section-gap">
        <div class="card">
          <h2>This week</h2>
          <div class="goal-line"><span>Informational requests</span><span><span class="num">${week.infos}</span> / ${g.informationals}</span></div>
          <div class="meter ${week.infos >= g.informationals ? 'met' : ''}"><span style="width:${pct(week.infos, g.informationals)}%"></span></div>
          <div class="goal-line" style="margin-top:14px"><span>Network touches</span><span><span class="num">${week.outreach}</span> / ${g.outreach}</span></div>
          <div class="meter ${week.outreach >= g.outreach ? 'met' : ''}"><span style="width:${pct(week.outreach, g.outreach)}%"></span></div>
          <div class="goal-line" style="margin-top:14px"><span>Targeted applications</span><span><span class="num">${week.apps}</span> / ${g.applications}</span></div>
          <div class="meter ${week.apps >= g.applications ? 'met' : ''}"><span style="width:${pct(week.apps, g.applications)}%"></span></div>
          <p class="muted small">Streak: <b style="color:var(--ink)">${streak}</b> week${streak === 1 ? '' : 's'} hitting all three${streak >= 2 ? ' 🔥' : ''} · weeks run Mon–Sun · goals editable in Settings</p>
          <p class="muted small" style="margin-bottom:0">Last 4 weeks: ${fn.touches} touches → ${fn.infos} informational requests → ${fn.meetings} meetings held → ${fn.referrals} referrals</p>
        </div>
        <div class="card">
          <h2>Follow-ups due ${due.contacts.length + due.apps.length + due.tasks.length + due.deadlines.length ? `<span class="overdue">(${due.contacts.length + due.apps.length + due.tasks.length + due.deadlines.length})</span>` : ''}</h2>
          ${(!due.contacts.length && !due.apps.length && !due.tasks.length && !due.deadlines.length) ? '<div class="empty-state">Nothing due. Set "next touch" dates on contacts, follow-up dates on applications, or due dates on tasks to see them here.</div>' : ''}
          <ul class="item-list">
            ${due.deadlines.map(a => `<li>
              <span class="grow"><span class="who">⏰ ${escapeHtml(a.company)}</span>
                <span class="muted small">${escapeHtml(a.role)}</span><br>
                <span class="${a.deadline < t ? 'overdue' : 'due-today'}">deadline ${a.deadline < t ? 'passed ' + fmtDate(a.deadline) : fmtDate(a.deadline) + (a.deadline === t ? ' — today' : '')}</span></span>
              <button class="ghost tiny" data-open-app="${a.id}">Open</button>
            </li>`).join('')}
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

      ${this.hillLineHtml()}
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
    const openHill = el.querySelector('#ov-open-hill');
    if (openHill) openHill.addEventListener('click', () => App.setTab('hill'));
    el.querySelectorAll('[data-open-meeting]').forEach(b => b.addEventListener('click', () => {
      const m = Store.state.meetings.find(x => x.id === b.dataset.openMeeting);
      Meetings.ui.selectedId = m.id;
      Meetings.ui.weekStart = weekStartISO(m.date);
      App.setTab('calendar');
    }));
  }
};
