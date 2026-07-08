/* App — tab routing, header countdown, settings tab, backup reminder, init. */

const App = {
  tab: 'overview',

  init() {
    Store.load();
    document.querySelectorAll('#tab-nav .tab').forEach(btn =>
      btn.addEventListener('click', () => this.setTab(btn.dataset.tab)));
    document.getElementById('quick-note-btn').addEventListener('click', () => Notes.quickCapture());
    this.render();
  },

  setTab(tab) {
    this.tab = tab;
    document.querySelectorAll('#tab-nav .tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('hidden', p.id !== 'tab-' + tab));
    this.render();
  },

  render() {
    this.renderHeader();
    this.renderBackupBanner();
    if (this.tab === 'overview') Dashboard.render();
    else if (this.tab === 'calendar') Meetings.render();
    else if (this.tab === 'contacts') Contacts.render();
    else if (this.tab === 'pipeline') Pipeline.render();
    else if (this.tab === 'stories') Stories.render();
    else if (this.tab === 'resume') Resume.render();
    else if (this.tab === 'notes') Notes.render();
    else if (this.tab === 'settings') this.renderSettings();
  },

  renderHeader() {
    const s = Store.state.settings;
    const daysLeft = Math.max(0, daysBetween(todayISO(), s.endDate));
    const total = Math.max(1, daysBetween(s.startDate, s.endDate));
    const dayNum = Math.min(total, Math.max(1, daysBetween(s.startDate, todayISO()) + 1));
    document.getElementById('countdown-chip').textContent = 'Day ' + dayNum + ' · ' + daysLeft + ' days left';
  },

  renderBackupBanner() {
    const el = document.getElementById('backup-banner');
    const s = Store.state.settings;
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
          <p class="muted small">The countdown on the Overview runs between these dates.</p>
          <h2 style="margin-top:14px">Weekly goals</h2>
          <div class="form-row">
            <div><label>Applications / week</label><input type="number" min="0" id="st-apps" value="${s.weeklyGoals.applications}" style="width:90px"></div>
            <div><label>Outreach touches / week</label><input type="number" min="0" id="st-out" value="${s.weeklyGoals.outreach}" style="width:90px"></div>
          </div>
        </div>
        <div class="card">
          <h2>Data</h2>
          <p class="muted small">Everything is stored locally in this browser (localStorage). Export a JSON backup regularly —
            keep it in this folder's <code>data/</code> directory or anywhere safe.
            ${s.lastBackup ? 'Last backup: <b style="color:var(--ink)">' + fmtDate(s.lastBackup) + '</b>.' : '<b class="due-today">No backup yet.</b>'}</p>
          <div class="form-row">
            <button class="primary" id="st-export">Export backup (JSON)</button>
            <button id="st-import">Restore from backup…</button>
            <input type="file" id="st-file" accept=".json,application/json" class="hidden">
          </div>
          <p class="muted small" id="st-msg"></p>
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
