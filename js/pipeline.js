/* Pipeline — kanban board for applications: Saved → Applied → Interviewing → Offer / Rejected. */

const Pipeline = {
  STATUSES: ['saved', 'applied', 'interviewing', 'offer', 'rejected'],
  LABELS: { saved: 'Saved', applied: 'Applied', interviewing: 'Interviewing', offer: 'Offer', rejected: 'Rejected' },
  ui: { showAdd: false, selectedId: null },

  addApplication(fields) {
    const a = Object.assign({
      id: Store.uid(),
      company: '', role: '', url: '', status: 'saved',
      appliedDate: null, followUpDate: null, contactId: '',
      notes: '', history: [{ status: fields.status || 'saved', date: todayISO() }]
    }, fields);
    Store.state.applications.push(a);
    if (a.status === 'applied') this.markApplied(a);
    return a;
  },

  /* Move to a new status: record history, and on "applied" stamp the date,
     suggest a +7d follow-up, and log an application activity for weekly goals. */
  setStatus(app, status) {
    if (app.status === status) return;
    app.status = status;
    app.history.push({ status, date: todayISO() });
    if (status === 'applied') this.markApplied(app);
  },

  markApplied(app) {
    if (!app.appliedDate) app.appliedDate = todayISO();
    if (!app.followUpDate) app.followUpDate = addDaysISO(todayISO(), 7);
    Store.state.activities.push({
      id: Store.uid(),
      applicationId: app.id,
      contactId: app.contactId || null,
      type: 'application',
      date: todayISO(),
      notes: 'Applied: ' + app.company + ' — ' + app.role
    });
  },

  stageDate(app) {
    const h = app.history && app.history.length ? app.history[app.history.length - 1] : null;
    return h ? h.date : app.appliedDate;
  },

  render() {
    const el = document.getElementById('tab-pipeline');
    const apps = Store.state.applications;

    el.innerHTML = `
      <div class="toolbar">
        <span class="muted small">${apps.length} application${apps.length === 1 ? '' : 's'} tracked</span>
        <span class="spacer"></span>
        <button class="primary" id="pl-add-btn">+ Add application</button>
      </div>
      <div id="pl-add-panel" class="card section-gap ${this.ui.showAdd ? '' : 'hidden'}">
        <h2>Add application</h2>
        <div class="form-row">
          <div><label>Company *</label><input id="pa-company"></div>
          <div><label>Role *</label><input id="pa-role"></div>
          <div style="min-width:200px"><label>Job posting URL</label><input id="pa-url"></div>
          <div><label>Referral contact</label>
            <select id="pa-contact">
              <option value="">None</option>
              ${Store.state.contacts.map(c => `<option value="${c.id}">${escapeHtml(contactName(c))}</option>`).join('')}
            </select></div>
          <div><label>Status</label>
            <select id="pa-status">${this.STATUSES.map(s => `<option value="${s}">${this.LABELS[s]}</option>`).join('')}</select></div>
          <div><button class="primary" id="pa-save">Save</button></div>
        </div>
      </div>
      ${apps.length ? '' : `<div class="card section-gap"><div class="empty-state">
        Nothing in the pipeline yet. Add roles as you find them — even "Saved" ones —
        so follow-ups and weekly goals track automatically.</div></div>`}
      <div class="kanban">
        ${this.STATUSES.map(s => this.columnHtml(s)).join('')}
      </div>
      ${this.drawerHtml()}
    `;
    this.bind(el);
  },

  columnHtml(status) {
    const cards = Store.state.applications
      .filter(a => a.status === status)
      .sort((a, b) => (this.stageDate(b) || '').localeCompare(this.stageDate(a) || ''));
    const idx = this.STATUSES.indexOf(status);
    return `<div class="kanban-col">
      <h3>${this.LABELS[status]} <span class="count">${cards.length}</span></h3>
      ${cards.map(a => {
        const contact = Store.state.contacts.find(c => c.id === a.contactId);
        const days = this.stageDate(a) ? daysBetween(this.stageDate(a), todayISO()) : 0;
        return `<div class="kcard status-${status}" data-id="${a.id}">
          <div class="co">${escapeHtml(a.company)}</div>
          <div class="role">${escapeHtml(a.role)}</div>
          ${contact ? `<div class="small muted">via ${escapeHtml(contactName(contact))}</div>` : ''}
          <div class="meta">
            <span>${days === 0 ? 'today' : days + 'd in stage'}</span>
            <span class="movers">
              ${idx > 0 ? `<button data-move="-1" data-id="${a.id}" title="Move to ${this.LABELS[this.STATUSES[idx - 1]]}">◀</button>` : ''}
              ${idx < this.STATUSES.length - 1 ? `<button data-move="1" data-id="${a.id}" title="Move to ${this.LABELS[this.STATUSES[idx + 1]]}">▶</button>` : ''}
            </span>
          </div>
        </div>`;
      }).join('')}
    </div>`;
  },

  drawerHtml() {
    const a = Store.state.applications.find(x => x.id === this.ui.selectedId);
    if (!a) return '';
    return `
      <div class="drawer-backdrop" id="pl-drawer-bg"></div>
      <div class="drawer">
        <div class="drawer-head">
          <h2>${escapeHtml(a.company)} — ${escapeHtml(a.role)}</h2>
          <div>
            <button class="danger tiny" id="pld-delete">Delete</button>
            <button class="ghost" id="pl-drawer-close">✕</button>
          </div>
        </div>
        <div class="grid grid-2">
          <div class="field"><label>Company</label><input data-af="company" value="${escapeHtml(a.company)}"></div>
          <div class="field"><label>Role</label><input data-af="role" value="${escapeHtml(a.role)}"></div>
          <div class="field"><label>Status</label>
            <select data-af="status">${this.STATUSES.map(s => `<option value="${s}" ${a.status === s ? 'selected' : ''}>${this.LABELS[s]}</option>`).join('')}</select></div>
          <div class="field"><label>Referral contact</label>
            <select data-af="contactId">
              <option value="">None</option>
              ${Store.state.contacts.map(c => `<option value="${c.id}" ${a.contactId === c.id ? 'selected' : ''}>${escapeHtml(contactName(c))}</option>`).join('')}
            </select></div>
          <div class="field"><label>Applied date</label><input type="date" data-af="appliedDate" value="${a.appliedDate || ''}"></div>
          <div class="field"><label>Follow-up date</label><input type="date" data-af="followUpDate" value="${a.followUpDate || ''}"></div>
        </div>
        <div class="field"><label>Job posting URL</label><input data-af="url" value="${escapeHtml(a.url || '')}"></div>
        <div class="field"><label>Notes</label><textarea data-af="notes" rows="4">${escapeHtml(a.notes || '')}</textarea></div>
        ${a.url ? `<p class="small"><a href="${escapeHtml(a.url)}" target="_blank" style="color:var(--accent)">Open job posting ↗</a></p>` : ''}
        <h3 style="margin:14px 0 4px">Status history</h3>
        ${(a.history || []).slice().reverse().map(h => `
          <div class="activity-item"><span class="muted">${fmtDate(h.date)}</span> · ${this.LABELS[h.status] || h.status}</div>`).join('')}
      </div>`;
  },

  bind(el) {
    el.querySelector('#pl-add-btn').addEventListener('click', () => { this.ui.showAdd = !this.ui.showAdd; App.render(); });

    const save = el.querySelector('#pa-save');
    if (save) save.addEventListener('click', () => {
      const v = id => el.querySelector('#' + id).value.trim();
      if (!v('pa-company') || !v('pa-role')) { alert('Company and role are required.'); return; }
      this.addApplication({
        company: v('pa-company'), role: v('pa-role'), url: v('pa-url'),
        contactId: el.querySelector('#pa-contact').value,
        status: el.querySelector('#pa-status').value
      });
      this.ui.showAdd = false;
      Store.save(); App.render();
    });

    // Move buttons (stop propagation so the card click doesn't open the drawer)
    el.querySelectorAll('button[data-move]').forEach(btn => btn.addEventListener('click', e => {
      e.stopPropagation();
      const app = Store.state.applications.find(x => x.id === btn.dataset.id);
      const idx = this.STATUSES.indexOf(app.status) + Number(btn.dataset.move);
      this.setStatus(app, this.STATUSES[Math.max(0, Math.min(this.STATUSES.length - 1, idx))]);
      Store.save(); App.render();
    }));

    el.querySelectorAll('.kcard[data-id]').forEach(card => card.addEventListener('click', () => {
      this.ui.selectedId = card.dataset.id; App.render();
    }));

    // Drawer
    const bg = el.querySelector('#pl-drawer-bg');
    if (!bg) return;
    const close = () => { this.ui.selectedId = null; App.render(); };
    bg.addEventListener('click', close);
    el.querySelector('#pl-drawer-close').addEventListener('click', close);

    const a = Store.state.applications.find(x => x.id === this.ui.selectedId);
    el.querySelectorAll('[data-af]').forEach(input => input.addEventListener('change', () => {
      const f = input.dataset.af;
      if (f === 'status') { this.setStatus(a, input.value); }
      else { a[f] = input.value || (input.type === 'date' ? null : ''); }
      Store.save(); App.render();
      this.ui.selectedId = a.id;
    }));
    el.querySelector('#pld-delete').addEventListener('click', () => {
      if (!confirm('Delete this application?')) return;
      Store.state.applications = Store.state.applications.filter(x => x.id !== a.id);
      this.ui.selectedId = null;
      Store.save(); App.render();
    });
  }
};
