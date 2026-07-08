/* Meetings — Calendar tab: week strip + agenda, auto-generated prep checklists,
   done → activity log + thank-you follow-up on the contact. */

const Meetings = {
  TYPES: ['coffee-chat', 'informational', 'recruiter-screen', 'interview', 'other'],
  TYPE_LABELS: {
    'coffee-chat': 'Coffee chat', informational: 'Informational',
    'recruiter-screen': 'Recruiter screen', interview: 'Interview', other: 'Meeting'
  },
  ui: { weekStart: null, showAdd: false, selectedId: null, debriefingId: null },

  personLabel(m) {
    const c = Store.state.contacts.find(x => x.id === m.contactId);
    return c ? contactName(c) : (m.personName || '(no name)');
  },

  /* Suggested prep checklist from what we know about the person + meeting type. */
  genPrep(contact, type, app) {
    const items = [];
    const name = contact ? contactName(contact) : null;
    const company = (contact && contact.company) || (app && app.company) || null;
    const add = text => items.push({ id: Store.uid(), text, done: false });

    if (contact && contact.linkedinUrl) add(`Review ${name}'s LinkedIn profile`);
    if (contact) add(`Reread your notes & history with ${name}`);
    if (company) add(`Look up recent news about ${company}`);

    if (type === 'interview' || type === 'recruiter-screen') {
      add('Reread the job description');
      add('Run the Resume/ATS matcher against this JD');
      add('Prepare STAR stories for the role');
      add("Rehearse your 'tell me about yourself'");
      if (app) add(`Review your application notes for ${app.company} — ${app.role}`);
    } else if (type === 'coffee-chat' || type === 'informational') {
      add('Draft your specific ask (advice, intro, referral)');
      add(`Know ${name ? name + "'s" : 'their'} career path so far`);
    }
    add(`Prepare 2–3 questions for ${name || 'them'}`);
    if (Store.state.stories.length) add('Pick 2–3 stories to have ready (see “Stories to have ready” below)');
    return items;
  },

  prepBadge(m) {
    const total = (m.prep || []).length;
    if (!total) return '';
    const done = m.prep.filter(p => p.done).length;
    return done === total
      ? '<span class="prep-badge done">Prep done ✓</span>'
      : `<span class="prep-badge">Prep ${done}/${total}</span>`;
  },

  meetingsOn(dateISO) {
    return Store.state.meetings
      .filter(m => m.date === dateISO)
      .sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  },

  render() {
    const el = document.getElementById('tab-calendar');
    if (!this.ui.weekStart) this.ui.weekStart = weekStartISO(todayISO());
    const days = Array.from({ length: 7 }, (_, i) => addDaysISO(this.ui.weekStart, i));

    el.innerHTML = `
      <div class="toolbar">
        <button class="tiny" id="cal-prev">◀</button>
        <button class="tiny" id="cal-today">Today</button>
        <button class="tiny" id="cal-next">▶</button>
        <span class="muted small">Week of ${fmtDate(this.ui.weekStart)}</span>
        <span class="spacer"></span>
        <button class="primary" id="cal-add-btn">+ Add meeting</button>
      </div>
      <div class="week-strip section-gap">
        ${days.map(d => {
          const n = this.meetingsOn(d).length;
          return `<button class="day-cell ${d === todayISO() ? 'today' : ''}" data-day="${d}">
            <span class="dow">${parseISO(d).toLocaleDateString(undefined, { weekday: 'short' })}</span>
            <span class="dom">${parseISO(d).getDate()}</span>
            <span class="dots">${'•'.repeat(Math.min(n, 4))}</span>
          </button>`;
        }).join('')}
      </div>
      ${this.addFormHtml()}
      ${this.agendaHtml(days)}
      ${this.drawerHtml()}
    `;
    this.bind(el);
  },

  addFormHtml() {
    return `<div id="cal-add-panel" class="card section-gap ${this.ui.showAdd ? '' : 'hidden'}">
      <h2>Add meeting</h2>
      <div class="form-row">
        <div><label>Contact</label>
          <select id="ma-contact">
            <option value="">— not in contacts —</option>
            ${Store.state.contacts.map(c => `<option value="${c.id}">${escapeHtml(contactName(c))}</option>`).join('')}
          </select></div>
        <div><label>Or type a name</label><input id="ma-person" placeholder="e.g. recruiter's name"></div>
        <div><label>Type</label>
          <select id="ma-type">${this.TYPES.map(t => `<option value="${t}">${this.TYPE_LABELS[t]}</option>`).join('')}</select></div>
        <div><label>Date</label><input type="date" id="ma-date" value="${todayISO()}"></div>
        <div><label>Time</label><input type="time" id="ma-time" value="10:00"></div>
        <div style="min-width:180px"><label>Location / video link</label><input id="ma-location" placeholder="Zoom, cafe…"></div>
        <div><label>Related application</label>
          <select id="ma-app">
            <option value="">None</option>
            ${Store.state.applications.map(a => `<option value="${a.id}">${escapeHtml(a.company + ' — ' + a.role)}</option>`).join('')}
          </select></div>
        <div><button class="primary" id="ma-save">Save</button></div>
      </div>
      <p class="muted small" style="margin-bottom:0">Saving generates a suggested prep checklist from the contact and meeting type — edit it in the meeting's detail view.</p>
    </div>`;
  },

  agendaHtml(days) {
    const total = days.reduce((n, d) => n + this.meetingsOn(d).length, 0);
    if (!total) {
      return `<div class="card"><div class="empty-state">
        No meetings this week. Use <b style="color:var(--ink)">+ Add meeting</b> to put next week's
        coffee chats and screens on the calendar — each one gets a prep checklist.</div></div>`;
    }
    return days.map(d => {
      const ms = this.meetingsOn(d);
      if (!ms.length) return '';
      return `<div class="card section-gap">
        <div class="agenda-day ${d === todayISO() ? 'is-today' : ''}">${parseISO(d).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}${d === todayISO() ? ' · today' : ''}</div>
        ${ms.map(m => `
          <div class="meeting-row ${m.done ? 'done' : ''}" data-id="${m.id}">
            <span class="mtime">${fmtTime(m.time)}</span>
            <span class="grow">
              <span class="who">${escapeHtml(this.personLabel(m))}</span>
              <span class="muted">· ${this.TYPE_LABELS[m.type] || m.type}</span>
              ${m.location ? `<span class="muted small"> · ${escapeHtml(m.location)}</span>` : ''}
            </span>
            ${m.done ? '<span class="muted small">done ✓</span>' : this.prepBadge(m)}
          </div>`).join('')}
      </div>`;
    }).join('');
  },

  drawerHtml() {
    const m = Store.state.meetings.find(x => x.id === this.ui.selectedId);
    if (!m) return '';
    const prep = m.prep || [];
    const doneCount = prep.filter(p => p.done).length;
    return `
      <div class="drawer-backdrop" id="cal-drawer-bg"></div>
      <div class="drawer">
        <div class="drawer-head">
          <h2>${escapeHtml(this.personLabel(m))} · ${this.TYPE_LABELS[m.type] || m.type}</h2>
          <div>
            <button class="danger tiny" id="md-delete">Delete</button>
            <button class="ghost" id="cal-drawer-close">✕</button>
          </div>
        </div>
        <div class="grid grid-2">
          <div class="field"><label>Contact</label>
            <select data-mf="contactId">
              <option value="">— not in contacts —</option>
              ${Store.state.contacts.map(c => `<option value="${c.id}" ${m.contactId === c.id ? 'selected' : ''}>${escapeHtml(contactName(c))}</option>`).join('')}
            </select></div>
          <div class="field"><label>Or name</label><input data-mf="personName" value="${escapeHtml(m.personName || '')}"></div>
          <div class="field"><label>Type</label>
            <select data-mf="type">${this.TYPES.map(t => `<option value="${t}" ${m.type === t ? 'selected' : ''}>${this.TYPE_LABELS[t]}</option>`).join('')}</select></div>
          <div class="field"><label>Related application</label>
            <select data-mf="applicationId">
              <option value="">None</option>
              ${Store.state.applications.map(a => `<option value="${a.id}" ${m.applicationId === a.id ? 'selected' : ''}>${escapeHtml(a.company + ' — ' + a.role)}</option>`).join('')}
            </select></div>
          <div class="field"><label>Date</label><input type="date" data-mf="date" value="${m.date || ''}"></div>
          <div class="field"><label>Time</label><input type="time" data-mf="time" value="${m.time || ''}"></div>
        </div>
        <div class="field"><label>Location / video link</label><input data-mf="location" value="${escapeHtml(m.location || '')}"></div>

        <h3 style="margin:16px 0 6px">Prep checklist ${prep.length ? `<span class="muted small">(${doneCount}/${prep.length})</span>` : ''}</h3>
        ${prep.map(p => `
          <div class="prep-item">
            <label class="prep-check"><input type="checkbox" data-prep-toggle="${p.id}" ${p.done ? 'checked' : ''}> <span>${escapeHtml(p.text)}</span></label>
            <button class="ghost tiny" data-prep-del="${p.id}" title="Remove">✕</button>
          </div>`).join('') || '<p class="muted small">No items — add your own below or regenerate suggestions.</p>'}
        <div class="form-row" style="margin-top:8px">
          <div style="flex:1;min-width:160px"><input id="md-prep-new" placeholder="Add a prep item…"></div>
          <div><button class="tiny" id="md-prep-add">Add</button></div>
          <div><button class="ghost tiny" id="md-prep-regen" title="Replace unchecked suggestions based on current contact/type">Regenerate suggestions</button></div>
        </div>
        <div class="field" style="margin-top:10px"><label>Prep notes / prereading</label>
          <textarea data-mf="prepNotes" rows="4" placeholder="Links to read, questions to ask, things they mentioned last time…">${escapeHtml(m.prepNotes || '')}</textarea></div>
        ${this.storiesSectionHtml(m)}
        ${this.doneSectionHtml(m)}
      </div>`;
  },

  storiesSectionHtml(m) {
    if (m.done || !Store.state.stories.length) return '';
    const stories = Stories.relevantFor(m);
    if (!stories.length) return '';
    return `<h3 style="margin:14px 0 4px">Stories to have ready</h3>
      ${stories.map(s => `
        <div class="activity-item" style="display:flex;align-items:center;gap:8px">
          <span style="flex:1"><span style="color:var(--ink)">${escapeHtml(s.title)}</span>
            ${(s.skills || []).slice(0, 3).map(k => `<span class="tag">${escapeHtml(k)}</span>`).join('')}</span>
          <button class="ghost tiny" data-open-story="${s.id}">Open</button>
        </div>`).join('')}`;
  },

  doneSectionHtml(m) {
    if (m.done) {
      const d = m.debrief || {};
      return `<p class="small" style="color:var(--good);margin:14px 0 6px">Meeting completed ✓</p>
        <h3 style="margin:0 0 6px">Debrief</h3>
        <div class="field"><label>What did you learn?</label><textarea data-df="learned" rows="2">${escapeHtml(d.learned || '')}</textarea></div>
        <div class="field"><label>Advice they gave you</label><textarea data-df="advice" rows="2">${escapeHtml(d.advice || '')}</textarea></div>
        <div class="field"><label>Your next ask with them</label><textarea data-df="nextAsk" rows="2">${escapeHtml(d.nextAsk || '')}</textarea></div>
        <p class="muted small">Did this conversation surface a story about you? Add it to the <b style="color:var(--ink)">Stories</b> tab while it's fresh.</p>`;
    }
    if (this.ui.debriefingId === m.id) {
      return `<div class="debrief-box">
        <h3 style="margin:0 0 4px">Quick debrief — while it's fresh</h3>
        <div class="field"><label>What did you learn?</label><textarea id="db-learned" rows="2" placeholder="About the role, the company, the path…"></textarea></div>
        <div class="field"><label>Advice they gave you</label><textarea id="db-advice" rows="2" placeholder="Acting on this — then telling them — is the best follow-up there is"></textarea></div>
        <div class="field"><label>Your next ask with them</label><textarea id="db-nextask" rows="2" placeholder="An intro? Feedback on your resume? A second chat in a month?"></textarea></div>
        <div class="form-row">
          <button class="primary" id="md-debrief-save">Save debrief &amp; log touch</button>
          <button class="ghost" id="md-debrief-skip">Skip — just log it</button>
        </div>
      </div>`;
    }
    return `<button class="primary" id="md-done" style="margin-top:14px">Mark done${m.contactId ? ' — logs a touch & sets a 3-day follow-up' : ''}</button>`;
  },

  bind(el) {
    el.querySelector('#cal-prev').addEventListener('click', () => { this.ui.weekStart = addDaysISO(this.ui.weekStart, -7); App.render(); });
    el.querySelector('#cal-next').addEventListener('click', () => { this.ui.weekStart = addDaysISO(this.ui.weekStart, 7); App.render(); });
    el.querySelector('#cal-today').addEventListener('click', () => { this.ui.weekStart = weekStartISO(todayISO()); App.render(); });
    el.querySelector('#cal-add-btn').addEventListener('click', () => { this.ui.showAdd = !this.ui.showAdd; App.render(); });

    el.querySelectorAll('.day-cell').forEach(btn => btn.addEventListener('click', () => {
      // Jump the add form's date to that day (and open it if closed).
      this.ui.showAdd = true; App.render();
      document.getElementById('ma-date').value = btn.dataset.day;
    }));

    const save = el.querySelector('#ma-save');
    if (save) save.addEventListener('click', () => {
      const contactId = el.querySelector('#ma-contact').value;
      const personName = el.querySelector('#ma-person').value.trim();
      if (!contactId && !personName) { alert('Pick a contact or type a name.'); return; }
      const type = el.querySelector('#ma-type').value;
      const applicationId = el.querySelector('#ma-app').value;
      const contact = Store.state.contacts.find(c => c.id === contactId);
      const app = Store.state.applications.find(a => a.id === applicationId);
      Store.state.meetings.push({
        id: Store.uid(),
        contactId, personName, type,
        date: el.querySelector('#ma-date').value || todayISO(),
        time: el.querySelector('#ma-time').value || '09:00',
        location: el.querySelector('#ma-location').value.trim(),
        applicationId,
        prep: this.genPrep(contact, type, app),
        prepNotes: '',
        done: false,
        createdAt: todayISO()
      });
      this.ui.showAdd = false;
      Store.save(); App.render();
    });

    el.querySelectorAll('.meeting-row[data-id]').forEach(row => row.addEventListener('click', () => {
      this.ui.selectedId = row.dataset.id; App.render();
    }));

    this.bindDrawer(el);
  },

  /* Shared completion logic for both the debrief-save and skip paths. */
  finishDone(m) {
    m.done = true;
    this.ui.debriefingId = null;
    const contact = Store.state.contacts.find(c => c.id === m.contactId);
    if (contact) {
      Store.state.activities.push({
        id: Store.uid(),
        contactId: contact.id,
        type: 'meeting',
        date: todayISO(),
        notes: (this.TYPE_LABELS[m.type] || 'Meeting') + ' — ' + contactName(contact)
      });
      contact.nextTouchDate = addDaysISO(todayISO(), 3);
      Store.save(); App.render();
      App.flash('Meeting logged for ' + contactName(contact) + ' — thank-you follow-up set for ' + fmtDate(contact.nextTouchDate) + '.');
    } else {
      Store.save(); App.render();
    }
  },

  bindDrawer(el) {
    const bg = el.querySelector('#cal-drawer-bg');
    if (!bg) return;
    const close = () => { this.ui.selectedId = null; App.render(); };
    bg.addEventListener('click', close);
    el.querySelector('#cal-drawer-close').addEventListener('click', close);

    const m = Store.state.meetings.find(x => x.id === this.ui.selectedId);

    el.querySelectorAll('[data-mf]').forEach(input => input.addEventListener('change', () => {
      m[input.dataset.mf] = input.value;
      Store.save();
      // Re-render so the drawer heading/person label track edits.
      if (input.dataset.mf !== 'prepNotes') App.render();
    }));

    el.querySelectorAll('[data-prep-toggle]').forEach(cb => cb.addEventListener('change', () => {
      const p = m.prep.find(x => x.id === cb.dataset.prepToggle);
      p.done = cb.checked;
      Store.save(); App.render();
    }));
    el.querySelectorAll('[data-prep-del]').forEach(btn => btn.addEventListener('click', () => {
      m.prep = m.prep.filter(x => x.id !== btn.dataset.prepDel);
      Store.save(); App.render();
    }));
    el.querySelector('#md-prep-add').addEventListener('click', () => {
      const input = document.getElementById('md-prep-new');
      const text = input.value.trim();
      if (!text) return;
      m.prep.push({ id: Store.uid(), text, done: false });
      Store.save(); App.render();
    });
    el.querySelector('#md-prep-regen').addEventListener('click', () => {
      const contact = Store.state.contacts.find(c => c.id === m.contactId);
      const app = Store.state.applications.find(a => a.id === m.applicationId);
      const checked = m.prep.filter(p => p.done);
      const fresh = this.genPrep(contact, m.type, app)
        .filter(n => !checked.some(c => c.text === n.text));
      m.prep = checked.concat(fresh);
      Store.save(); App.render();
    });

    const doneBtn = el.querySelector('#md-done');
    if (doneBtn) doneBtn.addEventListener('click', () => {
      this.ui.debriefingId = m.id;
      App.render();
    });

    const debriefSave = el.querySelector('#md-debrief-save');
    if (debriefSave) debriefSave.addEventListener('click', () => {
      m.debrief = {
        learned: document.getElementById('db-learned').value.trim(),
        advice: document.getElementById('db-advice').value.trim(),
        nextAsk: document.getElementById('db-nextask').value.trim(),
        adviceDone: false
      };
      this.finishDone(m);
    });
    const debriefSkip = el.querySelector('#md-debrief-skip');
    if (debriefSkip) debriefSkip.addEventListener('click', () => this.finishDone(m));

    // Editable debrief on already-done meetings
    el.querySelectorAll('[data-df]').forEach(input => input.addEventListener('change', () => {
      m.debrief = m.debrief || { adviceDone: false };
      m.debrief[input.dataset.df] = input.value.trim();
      Store.save();
    }));

    el.querySelectorAll('[data-open-story]').forEach(btn => btn.addEventListener('click', () => {
      Stories.ui.selectedId = btn.dataset.openStory;
      App.setTab('stories');
    }));

    const del = el.querySelector('#md-delete');
    del.addEventListener('click', () => {
      if (!confirm('Delete this meeting?')) return;
      Store.state.meetings = Store.state.meetings.filter(x => x.id !== m.id);
      this.ui.selectedId = null;
      Store.save(); App.render();
    });
  }
};
