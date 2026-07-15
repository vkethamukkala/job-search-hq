/* App — tab routing, header countdown, settings tab, backup reminder, init. */

const App = {
  tab: 'overview',

  init() {
    Store.load();
    Hill.ensureSeed();
    this.applyPersonalSeed();
    this.applyTheme();
    matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
      if (Store.state.settings.theme === 'system') this.applyTheme();
    });
    document.querySelectorAll('#tab-nav .tab').forEach(btn =>
      btn.addEventListener('click', () => this.setTab(btn.dataset.tab)));
    document.getElementById('quick-note-btn').addEventListener('click', () => Notes.quickCapture());
    AutoBackup.init().then(() => this.render());
    this.render();
  },

  /* Dark is the default; the inline <head> script mirrors this before first
     paint, and backup restore / wipe go through render() → applyTheme too. */
  applyTheme() {
    let t = Store.state.settings.theme || 'dark';
    if (t === 'system') t = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    document.documentElement.dataset.theme = t === 'light' ? 'light' : 'dark';
  },

  setTab(tab) {
    this.tab = tab;
    document.querySelectorAll('#tab-nav .tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('hidden', p.id !== 'tab-' + tab));
    this.render();
  },

  render() {
    this.applyTheme();
    this.renderHeader();
    this.renderBackupBanner();
    if (this.tab === 'overview') Dashboard.render();
    else if (this.tab === 'calendar') Meetings.render();
    else if (this.tab === 'contacts') Contacts.render();
    else if (this.tab === 'pipeline') Pipeline.render();
    else if (this.tab === 'hill') Hill.render();
    else if (this.tab === 'stories') Stories.render();
    else if (this.tab === 'skills') Skills.render();
    else if (this.tab === 'resume') Resume.render();
    else if (this.tab === 'notes') Notes.render();
    else if (this.tab === 'settings') this.renderSettings();
  },

  renderHeader() {
    const s = Store.state.settings;
    const el = document.getElementById('countdown-chip');
    const cp = currentPhase();
    if (cp) {
      const left = Math.max(0, daysBetween(todayISO(), cp.phase.end));
      el.textContent = 'Phase ' + (cp.idx + 1) + '/' + cp.total + ' · ' + cp.phase.name + ' · ' + left + 'd left in phase';
      return;
    }
    const daysLeft = Math.max(0, daysBetween(todayISO(), s.endDate));
    const total = Math.max(1, daysBetween(s.startDate, s.endDate));
    const dayNum = Math.min(total, Math.max(1, daysBetween(s.startDate, todayISO()) + 1));
    el.textContent = 'Day ' + dayNum + ' · ' + daysLeft + ' days left';
  },

  /* One-time application of the gitignored personal seed (js/personal-seed.js):
     purges known demo records by id, overrides settings, and seeds real
     stories / materials / references / tracked applications / tasks / notes.
     Guarded by settings.seededPersonal so user edits and deletions stick. */
  applyPersonalSeed() {
    const P = typeof PERSONAL_SEED !== 'undefined' ? PERSONAL_SEED : null;
    if (!P || Store.state.settings.seededPersonal) return;
    const st = Store.state;
    const purge = P.purge || {};
    ['contacts', 'applications', 'meetings', 'activities', 'stories', 'tasks', 'notes'].forEach(k => {
      if (Array.isArray(purge[k]) && purge[k].length) st[k] = st[k].filter(x => !purge[k].includes(x.id));
    });
    if (P.settings) Object.assign(st.settings, P.settings);
    (P.stories || []).forEach(s => st.stories.push(Object.assign(
      { id: Store.uid(), title: '', situation: '', action: '', result: '', skills: [], source: 'job', createdAt: todayISO() }, s)));
    (P.materials || []).forEach(m => st.materials.push(Object.assign(
      { id: Store.uid(), kind: 'writing-sample', title: '', hook: '', status: 'draft', body: '', createdAt: todayISO(), updatedAt: todayISO() }, m)));
    (P.references || []).forEach(r => st.references.push(Object.assign(
      { id: Store.uid(), name: '', role: '', status: 'to-ask', notes: '', contactId: '', createdAt: todayISO() }, r)));
    (P.applications || []).forEach(a => Pipeline.addApplication(a));
    (P.tasks || []).forEach(t => st.tasks.push(
      { id: Store.uid(), text: t.text, done: false, dueDate: t.dueDate || null, createdAt: todayISO(), doneAt: null }));
    (P.notes || []).forEach(n => st.notes.push(
      { id: Store.uid(), title: n.title || '', body: n.body || '', tags: n.tags || [], pinned: !!n.pinned, createdAt: todayISO(), updatedAt: todayISO() }));
    st.settings.seededPersonal = true;
    Store.save();
  },

  renderBackupBanner() {
    const el = document.getElementById('backup-banner');
    const s = Store.state.settings;
    if (AutoBackup.permission === 'prompt') {
      el.classList.remove('hidden');
      el.innerHTML = `Auto-backup is paused — the browser dropped folder access after restarting.
        <span class="spacer"></span><button class="tiny" id="bb-resume">Resume auto-backup</button>`;
      el.querySelector('#bb-resume').addEventListener('click', () => AutoBackup.resume().then(() => this.render()));
      return;
    }
    const hasData = Store.state.contacts.length || Store.state.applications.length || (s.resumeText || '').length;
    const stale = !s.lastBackup || daysBetween(s.lastBackup, todayISO()) >= 7;
    if (hasData && stale) {
      el.classList.remove('hidden');
      el.innerHTML = `Your data lives only in this browser — export a backup ${s.lastBackup ? '(last one ' + fmtDate(s.lastBackup) + ')' : ''} so it's safe.
        <span class="spacer"></span><button class="tiny" id="bb-export">Export backup</button>`;
      el.querySelector('#bb-export').addEventListener('click', () => { Store.exportJSON(); this.render(); });
    } else {
      el.classList.add('hidden');
      el.innerHTML = '';
    }
  },

  renderSettings() {
    const el = document.getElementById('tab-settings');
    const s = Store.state.settings;
    el.innerHTML = `
      <div class="grid grid-2 section-gap">
        <div class="card">
          <h2>Search window</h2>
          <div class="form-row">
            <div><label>Start date</label><input type="date" id="st-start" value="${s.startDate}"></div>
            <div><label>End date</label><input type="date" id="st-end" value="${s.endDate}"></div>
          </div>
          <p class="muted small">The countdown on the Overview runs between these dates (phases below take over the display when defined).</p>
          <h2 style="margin-top:14px">Weekly goals</h2>
          <div class="form-row">
            <div><label>Informational requests / wk</label><input type="number" min="0" id="st-info" value="${s.weeklyGoals.informationals}" style="width:90px"></div>
            <div><label>Network touches / wk</label><input type="number" min="0" id="st-out" value="${s.weeklyGoals.outreach}" style="width:90px"></div>
            <div><label>Targeted applications / wk</label><input type="number" min="0" id="st-apps" value="${s.weeklyGoals.applications}" style="width:90px"></div>
          </div>
          <p class="muted small">Hill hiring runs on informationals and referrals, not mass applications — the goals measure what predicts an offer.</p>
          <h2 style="margin-top:14px">Search phases</h2>
          <p class="muted small">Named stretches of the plan (e.g. liaison push, August recess, vacancy boards, transition window). The header chip and Overview timeline follow these.</p>
          ${(s.phases || []).map((p, i) => `
            <div class="form-row" style="align-items:flex-end">
              <div style="flex:1;min-width:180px"><label>Phase ${i + 1}</label><input data-ph-name="${i}" value="${escapeHtml(p.name || '')}"></div>
              <div><label>Start</label><input type="date" data-ph-start="${i}" value="${p.start || ''}"></div>
              <div><label>End</label><input type="date" data-ph-end="${i}" value="${p.end || ''}"></div>
              <div><button class="ghost tiny" data-ph-del="${i}" title="Remove phase">✕</button></div>
            </div>`).join('')}
          <button class="tiny" id="st-ph-add" style="margin-top:6px">+ Add phase</button>
        </div>
        <div class="card">
          <h2>Appearance</h2>
          <div class="form-row">
            <div><label>Theme</label><select id="st-theme">
              ${[['dark', 'Dark'], ['light', 'Light'], ['system', 'Match system']].map(([v, label]) =>
                `<option value="${v}" ${(s.theme || 'dark') === v ? 'selected' : ''}>${label}</option>`).join('')}
            </select></div>
          </div>
          <h2 style="margin-top:14px">Data</h2>
          <p class="muted small">Everything is stored locally in this browser (localStorage). Export a JSON backup regularly —
            keep it in this folder's <code>data/</code> directory or anywhere safe.
            ${s.lastBackup ? 'Last backup: <b style="color:var(--ink)">' + fmtDate(s.lastBackup) + '</b>.' : '<b class="due-today">No backup yet.</b>'}</p>
          <div class="form-row">
            <button class="primary" id="st-export">Export backup (JSON)</button>
            <button id="st-import">Restore from backup…</button>
            <input type="file" id="st-file" accept=".json,application/json" class="hidden">
          </div>
          <p class="muted small" id="st-msg"></p>
          <h2 style="margin-top:14px">Automatic backup</h2>
          ${AutoBackup.supported() ? `
            <p class="muted small" id="ab-status">${AutoBackup.permission === 'off'
              ? 'Pick a folder once (this project’s <code>data/</code> is gitignored and ideal) and every change auto-saves a backup there — no more manual exports.'
              : escapeHtml(AutoBackup.statusText())}</p>
            <div class="form-row">
              ${AutoBackup.permission === 'granted'
                ? '<button id="ab-off">Turn off auto-backup</button>'
                : AutoBackup.permission === 'prompt'
                  ? '<button class="primary" id="ab-resume">Resume auto-backup</button><button id="ab-off">Turn off</button>'
                  : '<button class="primary" id="ab-pick">Choose backup folder…</button>'}
            </div>`
          : '<p class="muted small">Your browser doesn’t support automatic folder backups (needs Chrome or Edge) — keep using manual exports.</p>'}
          <h2 style="margin-top:14px">Danger zone</h2>
          <button class="danger" id="st-wipe">Erase all data</button>
        </div>
      </div>
    `;

    const save = () => { Store.save(); this.renderHeader(); };
    el.querySelector('#st-start').addEventListener('change', e => { s.startDate = e.target.value || todayISO(); save(); });
    el.querySelector('#st-end').addEventListener('change', e => { s.endDate = e.target.value || addDaysISO(s.startDate, 90); save(); });
    el.querySelector('#st-apps').addEventListener('change', e => { s.weeklyGoals.applications = Math.max(0, Number(e.target.value) || 0); save(); });
    el.querySelector('#st-out').addEventListener('change', e => { s.weeklyGoals.outreach = Math.max(0, Number(e.target.value) || 0); save(); });
    el.querySelector('#st-info').addEventListener('change', e => { s.weeklyGoals.informationals = Math.max(0, Number(e.target.value) || 0); save(); });

    el.querySelectorAll('[data-ph-name]').forEach(inp => inp.addEventListener('change', () => { s.phases[Number(inp.dataset.phName)].name = inp.value.trim(); save(); }));
    el.querySelectorAll('[data-ph-start]').forEach(inp => inp.addEventListener('change', () => { s.phases[Number(inp.dataset.phStart)].start = inp.value || ''; save(); }));
    el.querySelectorAll('[data-ph-end]').forEach(inp => inp.addEventListener('change', () => { s.phases[Number(inp.dataset.phEnd)].end = inp.value || ''; save(); }));
    el.querySelectorAll('[data-ph-del]').forEach(btn => btn.addEventListener('click', () => {
      s.phases.splice(Number(btn.dataset.phDel), 1); Store.save(); this.render();
    }));
    el.querySelector('#st-ph-add').addEventListener('click', () => {
      const last = s.phases[s.phases.length - 1];
      const start = last && last.end ? addDaysISO(last.end, 1) : todayISO();
      s.phases.push({ name: 'New phase', start, end: addDaysISO(start, 30) });
      Store.save(); this.render();
    });

    el.querySelector('#st-theme').addEventListener('change', e => {
      s.theme = e.target.value;
      Store.save();
      this.applyTheme();
    });

    const abPick = el.querySelector('#ab-pick');
    if (abPick) abPick.addEventListener('click', async () => {
      try {
        await AutoBackup.pickFolder();
        this.render();
        this.flash('Auto-backup is on — every change now saves a backup to that folder.');
      } catch (e) { /* picker cancelled */ }
    });
    const abResume = el.querySelector('#ab-resume');
    if (abResume) abResume.addEventListener('click', () => AutoBackup.resume().then(() => this.render()));
    const abOff = el.querySelector('#ab-off');
    if (abOff) abOff.addEventListener('click', () => AutoBackup.disable().then(() => this.render()));

    el.querySelector('#st-export').addEventListener('click', () => { Store.exportJSON(); this.render(); });
    el.querySelector('#st-import').addEventListener('click', () => el.querySelector('#st-file').click());
    el.querySelector('#st-file').addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      Store.importJSON(file, err => {
        if (err) { document.getElementById('st-msg').innerHTML = '<span class="overdue">' + escapeHtml(err) + '</span>'; }
        else { this.render(); this.flash('Backup restored.'); }
      });
    });
    el.querySelector('#st-wipe').addEventListener('click', () => {
      if (!confirm('Erase ALL contacts, applications, and settings from this browser? Export a backup first if in doubt.')) return;
      localStorage.removeItem(Store.KEY);
      Store.load();
      this.setTab('overview');
    });
  },

  /* Small transient confirmation message in the banner slot. */
  flash(msg) {
    const el = document.getElementById('backup-banner');
    el.classList.remove('hidden');
    el.style.borderLeftColor = 'var(--good)';
    el.textContent = msg;
    setTimeout(() => { el.style.borderLeftColor = ''; this.renderBackupBanner(); }, 2500);
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
