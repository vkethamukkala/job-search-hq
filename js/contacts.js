/* Contacts — table, search/filters, quick-add, LinkedIn CSV import, detail drawer. */

const Contacts = {
  ui: { search: '', warmth: '', sort: 'name', sortDir: 1, selectedId: null, preview: null, showAdd: false },

  addContact(fields) {
    const c = Object.assign({
      id: Store.uid(),
      firstName: '', lastName: '', company: '', position: '',
      email: '', linkedinUrl: '', tags: [], warmth: 'neutral',
      nextTouchDate: null, notes: '', createdAt: todayISO()
    }, fields);
    Store.state.contacts.push(c);
    return c;
  },

  /* Dedupe key: LinkedIn URL if present, else name+company. */
  dupeKey(c) {
    const url = (c.linkedinUrl || '').toLowerCase().replace(/\/+$/, '');
    if (url) return 'u:' + url;
    return 'n:' + (c.firstName + '|' + c.lastName + '|' + (c.company || '')).toLowerCase();
  },

  render() {
    const el = document.getElementById('tab-contacts');
    const ui = this.ui;
    const list = this.filtered();

    el.innerHTML = `
      <div class="toolbar">
        <input type="search" id="ct-search" placeholder="Search name, company, position…" value="${escapeHtml(ui.search)}" style="min-width:220px">
        <select id="ct-warmth">
          <option value="">All warmth</option>
          <option value="warm" ${ui.warmth === 'warm' ? 'selected' : ''}>Warm</option>
          <option value="neutral" ${ui.warmth === 'neutral' ? 'selected' : ''}>Neutral</option>
          <option value="cold" ${ui.warmth === 'cold' ? 'selected' : ''}>Cold</option>
        </select>
        <span class="muted small">${Store.state.contacts.length} contact${Store.state.contacts.length === 1 ? '' : 's'}</span>
        <span class="spacer"></span>
        <button id="ct-import-btn">Import LinkedIn CSV</button>
        <input type="file" id="ct-file" accept=".csv,text/csv" class="hidden">
        <button class="primary" id="ct-add-btn">+ Add contact</button>
      </div>
      <div id="ct-add-panel" class="card section-gap ${ui.showAdd ? '' : 'hidden'}">
        <h2>Quick add</h2>
        <div class="form-row">
          <div><label>First name</label><input id="qa-first"></div>
          <div><label>Last name</label><input id="qa-last"></div>
          <div><label>Company</label><input id="qa-company"></div>
          <div><label>Position</label><input id="qa-position"></div>
          <div><label>Email</label><input id="qa-email"></div>
          <div><button class="primary" id="qa-save">Save</button></div>
        </div>
      </div>
      <div id="ct-import-panel"></div>
      ${this.tableHtml(list)}
      ${this.drawerHtml()}
    `;
    this.bind(el);
  },

  filtered() {
    const q = this.ui.search.trim().toLowerCase();
    let list = Store.state.contacts.filter(c => {
      if (this.ui.warmth && c.warmth !== this.ui.warmth) return false;
      if (!q) return true;
      return (contactName(c) + ' ' + (c.company || '') + ' ' + (c.position || '') + ' ' + (c.tags || []).join(' '))
        .toLowerCase().includes(q);
    });
    const key = this.ui.sort, dir = this.ui.sortDir;
    list.sort((a, b) => {
      let av, bv;
      if (key === 'name') { av = contactName(a).toLowerCase(); bv = contactName(b).toLowerCase(); }
      else if (key === 'nextTouch') { av = a.nextTouchDate || '9999'; bv = b.nextTouchDate || '9999'; }
      else { av = (a[key] || '').toLowerCase(); bv = (b[key] || '').toLowerCase(); }
      return av < bv ? -dir : av > bv ? dir : 0;
    });
    return list;
  },

  tableHtml(list) {
    if (!Store.state.contacts.length) {
      return `<div class="card"><div class="empty-state">
        No contacts yet. Import your LinkedIn connections or add people manually.<br><br>
        <b style="color:var(--ink)">To get your LinkedIn export:</b><br>
        LinkedIn → Settings &amp; Privacy → Data privacy → <i>Get a copy of your data</i> → select <b>Connections</b>.<br>
        LinkedIn emails you a <code>Connections.csv</code> in ~10 minutes — import it with the button above.
      </div></div>`;
    }
    if (!list.length) return `<div class="card"><div class="empty-state">No contacts match the current filters.</div></div>`;
    const arrow = k => this.ui.sort === k ? (this.ui.sortDir === 1 ? ' ↑' : ' ↓') : '';
    return `<div class="card table-wrap"><table>
      <thead><tr>
        <th data-sort="name">Name${arrow('name')}</th>
        <th data-sort="company">Company${arrow('company')}</th>
        <th data-sort="position">Position${arrow('position')}</th>
        <th data-sort="warmth">Warmth${arrow('warmth')}</th>
        <th data-sort="nextTouch">Next touch${arrow('nextTouch')}</th>
        <th>Tags</th>
      </tr></thead>
      <tbody>${list.map(c => `
        <tr data-id="${c.id}">
          <td class="name-cell">${escapeHtml(contactName(c))}</td>
          <td>${escapeHtml(c.company || '')}</td>
          <td>${escapeHtml(c.position || '')}</td>
          <td class="warmth-${c.warmth}">${c.warmth === 'neutral' ? '—' : escapeHtml(c.warmth)}</td>
          <td>${c.nextTouchDate ? `<span class="${c.nextTouchDate <= todayISO() ? 'overdue' : ''}">${fmtDate(c.nextTouchDate)}</span>` : ''}</td>
          <td>${(c.tags || []).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</td>
        </tr>`).join('')}
      </tbody></table></div>`;
  },

  importPanelHtml() {
    const p = this.ui.preview;
    if (!p) return '';
    if (p.error) return `<div class="card section-gap"><span class="overdue">${escapeHtml(p.error)}</span>
      <button class="ghost tiny" id="imp-cancel">Dismiss</button></div>`;
    return `<div class="card section-gap">
      <h2>Import preview</h2>
      <p>${p.fresh.length} new contact${p.fresh.length === 1 ? '' : 's'} to import.
         ${p.dupes ? `<span class="muted">${p.dupes} already in your list (skipped).</span>` : ''}
         ${p.skipped ? `<span class="muted">${p.skipped} empty row${p.skipped === 1 ? '' : 's'} ignored.</span>` : ''}</p>
      ${p.fresh.length ? `<p class="muted small">${p.fresh.slice(0, 8).map(c => escapeHtml(contactName(c) + (c.company ? ' · ' + c.company : ''))).join('<br>')}
        ${p.fresh.length > 8 ? '<br>…and ' + (p.fresh.length - 8) + ' more' : ''}</p>` : ''}
      <div class="form-row">
        ${p.fresh.length ? `<button class="primary" id="imp-confirm">Import ${p.fresh.length}</button>` : ''}
        <button id="imp-cancel">Cancel</button>
      </div>
    </div>`;
  },

  drawerHtml() {
    const c = Store.state.contacts.find(x => x.id === this.ui.selectedId);
    if (!c) return '';
    const acts = Store.state.activities
      .filter(a => a.contactId === c.id)
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    return `
      <div class="drawer-backdrop" id="drawer-close-bg"></div>
      <div class="drawer">
        <div class="drawer-head">
          <h2>${escapeHtml(contactName(c))}</h2>
          <div>
            <button class="danger tiny" id="ctd-delete">Delete</button>
            <button class="ghost" id="drawer-close">✕</button>
          </div>
        </div>
        <div class="grid grid-2">
          <div class="field"><label>First name</label><input data-cf="firstName" value="${escapeHtml(c.firstName)}"></div>
          <div class="field"><label>Last name</label><input data-cf="lastName" value="${escapeHtml(c.lastName)}"></div>
          <div class="field"><label>Company</label><input data-cf="company" value="${escapeHtml(c.company || '')}"></div>
          <div class="field"><label>Position</label><input data-cf="position" value="${escapeHtml(c.position || '')}"></div>
          <div class="field"><label>Email</label><input data-cf="email" value="${escapeHtml(c.email || '')}"></div>
          <div class="field"><label>LinkedIn URL</label><input data-cf="linkedinUrl" value="${escapeHtml(c.linkedinUrl || '')}"></div>
          <div class="field"><label>Warmth</label>
            <select data-cf="warmth">
              <option value="warm" ${c.warmth === 'warm' ? 'selected' : ''}>Warm</option>
              <option value="neutral" ${c.warmth === 'neutral' ? 'selected' : ''}>Neutral</option>
              <option value="cold" ${c.warmth === 'cold' ? 'selected' : ''}>Cold</option>
            </select></div>
          <div class="field"><label>Next touch date</label><input type="date" data-cf="nextTouchDate" value="${c.nextTouchDate || ''}"></div>
        </div>
        <div class="field"><label>Tags (comma-separated)</label><input id="ctd-tags" value="${escapeHtml((c.tags || []).join(', '))}"></div>
        <div class="field"><label>Notes</label><textarea data-cf="notes" rows="3">${escapeHtml(c.notes || '')}</textarea></div>
        ${c.linkedinUrl ? `<p class="small"><a href="${escapeHtml(c.linkedinUrl)}" target="_blank" style="color:var(--accent)">Open LinkedIn profile ↗</a></p>` : ''}
        <h3 style="margin:16px 0 8px">Log activity</h3>
        <div class="form-row">
          <div><label>Type</label>
            <select id="act-type">
              <option value="outreach">Outreach message</option>
              <option value="informational">Informational request</option>
              <option value="coffee-chat">Coffee chat</option>
              <option value="call">Call</option>
              <option value="email">Email</option>
              <option value="referral">Referral ask</option>
              <option value="other">Other</option>
            </select></div>
          <div><label>Date</label><input type="date" id="act-date" value="${todayISO()}"></div>
          <div style="flex:1;min-width:140px"><label>Note</label><input id="act-note" placeholder="Optional"></div>
          <div><button class="primary" id="act-save">Log</button></div>
        </div>
        <h3 style="margin:16px 0 4px">History</h3>
        ${acts.length ? acts.map(a => `
          <div class="activity-item">
            <span class="muted">${fmtDate(a.date)}</span> · ${escapeHtml(a.type)}
            ${a.notes ? `<div class="muted small">${escapeHtml(a.notes)}</div>` : ''}
          </div>`).join('') : '<div class="muted small">No activity logged yet.</div>'}
      </div>`;
  },

  bind(el) {
    const rerender = () => App.render();

    el.querySelector('#ct-search').addEventListener('input', e => {
      this.ui.search = e.target.value;
      App.render();
      // Re-rendering replaces the input — restore focus so typing continues.
      const s = document.getElementById('ct-search');
      s.focus(); s.setSelectionRange(s.value.length, s.value.length);
    });
    el.querySelector('#ct-warmth').addEventListener('change', e => { this.ui.warmth = e.target.value; rerender(); });
    el.querySelector('#ct-add-btn').addEventListener('click', () => { this.ui.showAdd = !this.ui.showAdd; rerender(); });

    // Quick add
    const qaSave = el.querySelector('#qa-save');
    if (qaSave) qaSave.addEventListener('click', () => {
      const v = id => el.querySelector('#' + id).value.trim();
      if (!v('qa-first') && !v('qa-last')) { alert('A first or last name is required.'); return; }
      this.addContact({ firstName: v('qa-first'), lastName: v('qa-last'), company: v('qa-company'), position: v('qa-position'), email: v('qa-email') });
      this.ui.showAdd = false;
      Store.save(); rerender();
    });

    // CSV import
    el.querySelector('#ct-import-btn').addEventListener('click', () => el.querySelector('#ct-file').click());
    el.querySelector('#ct-file').addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const res = CSV.parseLinkedIn(reader.result);
        if (res.error) { this.ui.preview = { error: res.error }; }
        else {
          const existing = new Set(Store.state.contacts.map(c => this.dupeKey(c)));
          const fresh = [], seen = new Set();
          let dupes = 0;
          for (const c of res.contacts) {
            const k = this.dupeKey(c);
            if (existing.has(k) || seen.has(k)) { dupes++; continue; }
            seen.add(k); fresh.push(c);
          }
          this.ui.preview = { fresh, dupes, skipped: res.skipped };
        }
        document.getElementById('ct-import-panel').innerHTML = this.importPanelHtml();
        this.bindImportPanel();
      };
      reader.readAsText(file);
    });

    this.bindImportPanel();

    // Table interactions
    el.querySelectorAll('th[data-sort]').forEach(th => th.addEventListener('click', () => {
      const k = th.dataset.sort;
      if (this.ui.sort === k) this.ui.sortDir *= -1; else { this.ui.sort = k; this.ui.sortDir = 1; }
      rerender();
    }));
    el.querySelectorAll('tbody tr[data-id]').forEach(tr => tr.addEventListener('click', () => {
      this.ui.selectedId = tr.dataset.id; rerender();
    }));

    this.bindDrawer(el);
  },

  bindImportPanel() {
    const panel = document.getElementById('ct-import-panel');
    if (!panel) return;
    panel.innerHTML = this.importPanelHtml();
    const cancel = panel.querySelector('#imp-cancel');
    if (cancel) cancel.addEventListener('click', () => { this.ui.preview = null; App.render(); });
    const confirm = panel.querySelector('#imp-confirm');
    if (confirm) confirm.addEventListener('click', () => {
      for (const c of this.ui.preview.fresh) {
        this.addContact({
          firstName: c.firstName, lastName: c.lastName, company: c.company,
          position: c.position, email: c.email, linkedinUrl: c.linkedinUrl,
          notes: c.connectedOn ? 'Connected on LinkedIn: ' + c.connectedOn : ''
        });
      }
      const n = this.ui.preview.fresh.length;
      this.ui.preview = null;
      Store.save(); App.render();
      App.flash(n + ' contacts imported.');
    });
  },

  bindDrawer(el) {
    const close = () => { this.ui.selectedId = null; App.render(); };
    const bg = el.querySelector('#drawer-close-bg');
    if (!bg) return;
    bg.addEventListener('click', close);
    el.querySelector('#drawer-close').addEventListener('click', close);

    const c = Store.state.contacts.find(x => x.id === this.ui.selectedId);

    el.querySelectorAll('[data-cf]').forEach(input => input.addEventListener('change', () => {
      c[input.dataset.cf] = input.value || (input.type === 'date' ? null : '');
      Store.save();
      App.renderHeader();
    }));
    el.querySelector('#ctd-tags').addEventListener('change', e => {
      c.tags = e.target.value.split(',').map(t => t.trim()).filter(Boolean);
      Store.save();
    });
    el.querySelector('#ctd-delete').addEventListener('click', () => {
      if (!confirm('Delete ' + contactName(c) + ' and their activity history?')) return;
      Store.state.contacts = Store.state.contacts.filter(x => x.id !== c.id);
      Store.state.activities = Store.state.activities.filter(a => a.contactId !== c.id);
      this.ui.selectedId = null;
      Store.save(); App.render();
    });
    el.querySelector('#act-save').addEventListener('click', () => {
      Store.state.activities.push({
        id: Store.uid(),
        contactId: c.id,
        type: el.querySelector('#act-type').value,
        date: el.querySelector('#act-date').value || todayISO(),
        notes: el.querySelector('#act-note').value.trim()
      });
      Store.save(); App.render();
    });
  }
};
