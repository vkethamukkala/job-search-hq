/* Hill — congressional target list: members, committees, prospective offices.
   Seeded with real 119th-Congress data (web-verified 2026-07-08); assignments
   shift when the 120th Congress is seated 2027-01-03, so every target carries
   a verifiedAt date and the UI flags stale ones. */

const Hill = {
  ui: { search: '', chamber: '', lane: '', hook: '', status: '', selectedId: null, showAdd: false },

  LANES: { defense: 'Defense & Indo-Pacific', tech: 'Tech & export controls' },
  HOOKS: {
    nc: 'NC constituent',
    'harvard-ma': 'Harvard / MA',
    'india-caucus': 'India Caucus / diaspora',
    'think-tank': 'Think-tank overlap'
  },
  STATUSES: {
    researching: 'Researching',
    ready: 'Narrative ready',
    'sent-to-liaison': 'With liaison',
    'intro-made': 'Intro made',
    'meeting-set': 'Meeting set',
    parked: 'Parked'
  },
  PRIORITIES: ['high', 'medium', 'low'],
  TURNOVER: '2027-01-03', // 120th Congress seated — assignments need re-verifying after this

  /* ---------- one-time seed (user deletions stay deleted) ---------- */

  ensureSeed() {
    // SEED lives in js/hill-seed.js, which is gitignored (it holds personal
    // strategy) — on deployments without it, the tab just starts empty.
    if (Store.state.settings.seededHill || !Array.isArray(this.SEED)) return;
    this.SEED.forEach(t => Store.state.hillTargets.push(Object.assign({
      id: Store.uid(), kind: 'member', party: null, state: '', title: '',
      committees: [], caucuses: [], lanes: [], hooks: [],
      whyThem: '', narrative: '', status: 'researching', priority: 'medium',
      verifiedAt: '2026-07-08', sourceNote: '', notes: '', contactId: null,
      createdAt: todayISO()
    }, t)));
    Store.state.settings.seededHill = true;
    Store.save();
  },

  needsVerify(t) {
    return t.verifiedAt && todayISO() >= this.TURNOVER && t.verifiedAt < this.TURNOVER;
  },

  filtered() {
    const q = this.ui.search.trim().toLowerCase();
    const rank = { high: 0, medium: 1, low: 2 };
    return Store.state.hillTargets.filter(t => {
      if (this.ui.chamber && t.chamber !== this.ui.chamber) return false;
      if (this.ui.lane && !(t.lanes || []).includes(this.ui.lane)) return false;
      if (this.ui.hook && !(t.hooks || []).includes(this.ui.hook)) return false;
      if (this.ui.status && t.status !== this.ui.status) return false;
      if (!q) return true;
      return (t.name + ' ' + t.title + ' ' + (t.committees || []).join(' ') + ' ' + t.state + ' ' + t.whyThem)
        .toLowerCase().includes(q);
    }).sort((a, b) =>
      (rank[a.priority] ?? 1) - (rank[b.priority] ?? 1) ||
      a.name.localeCompare(b.name));
  },

  render() {
    const el = document.getElementById('tab-hill');
    const all = Store.state.hillTargets;
    const counts = { researching: 0, ready: 0, liaison: 0, meetings: 0 };
    all.forEach(t => {
      if (t.status === 'researching') counts.researching++;
      else if (t.status === 'ready') counts.ready++;
      else if (t.status === 'sent-to-liaison' || t.status === 'intro-made') counts.liaison++;
      else if (t.status === 'meeting-set') counts.meetings++;
    });
    const list = this.filtered();

    el.innerHTML = `
      <div class="tile-row section-gap">
        <div class="stat-tile"><div class="label">Researching</div><div class="value">${counts.researching}</div></div>
        <div class="stat-tile"><div class="label">Narrative ready</div><div class="value">${counts.ready}</div></div>
        <div class="stat-tile"><div class="label">With liaison</div><div class="value">${counts.liaison}</div></div>
        <div class="stat-tile"><div class="label">Meetings set</div><div class="value">${counts.meetings}</div></div>
      </div>

      <div class="toolbar section-gap">
        <input type="search" id="hl-search" placeholder="Search targets…" value="${escapeHtml(this.ui.search)}" style="flex:1;min-width:140px">
        <select id="hl-chamber">
          <option value="">Both chambers</option>
          <option value="senate" ${this.ui.chamber === 'senate' ? 'selected' : ''}>Senate</option>
          <option value="house" ${this.ui.chamber === 'house' ? 'selected' : ''}>House</option>
        </select>
        <select id="hl-lane">
          <option value="">All lanes</option>
          ${Object.entries(this.LANES).map(([k, v]) => `<option value="${k}" ${this.ui.lane === k ? 'selected' : ''}>${v}</option>`).join('')}
        </select>
        <select id="hl-hook">
          <option value="">All hooks</option>
          ${Object.entries(this.HOOKS).map(([k, v]) => `<option value="${k}" ${this.ui.hook === k ? 'selected' : ''}>${v}</option>`).join('')}
        </select>
        <select id="hl-status">
          <option value="">All statuses</option>
          ${Object.entries(this.STATUSES).map(([k, v]) => `<option value="${k}" ${this.ui.status === k ? 'selected' : ''}>${v}</option>`).join('')}
        </select>
        <button id="hl-brief">Copy full brief for liaison</button>
        <button class="primary" id="hl-add-btn">+ Add target</button>
      </div>

      <div class="card section-gap ${this.ui.showAdd ? '' : 'hidden'}">
        <div class="form-row">
          <div style="flex:1;min-width:160px"><label>Name</label><input id="ha-name" placeholder="Sen. Jane Doe / Committee name"></div>
          <div><label>Kind</label><select id="ha-kind">
            <option value="member">Member</option><option value="prospective">Prospective</option><option value="committee">Committee</option>
          </select></div>
          <div><label>Chamber</label><select id="ha-chamber"><option value="senate">Senate</option><option value="house">House</option></select></div>
          <div><label>Party</label><select id="ha-party"><option value="">—</option><option>D</option><option>R</option><option>I</option></select></div>
          <div style="width:70px"><label>State</label><input id="ha-state" placeholder="NC"></div>
          <div><button class="primary" id="ha-save">Add</button></div>
        </div>
      </div>

      ${list.length ? list.map(t => this.cardHtml(t)).join('')
        : `<div class="card"><div class="empty-state">${all.length ? 'No targets match the current filters.' : 'No targets yet — add one above.'}</div></div>`}
      ${this.drawerHtml()}
    `;
    this.bind(el);
  },

  cardHtml(t) {
    return `
      <div class="hill-card" data-id="${t.id}">
        <div class="hill-head">
          <span class="hill-name">${escapeHtml(t.name)}</span>
          ${t.party ? `<span class="party-chip party-${t.party}">${t.party}${t.state ? '-' + escapeHtml(t.state) : ''}</span>`
            : t.state ? `<span class="party-chip">${escapeHtml(t.state)}</span>` : ''}
          ${t.kind === 'prospective' ? '<span class="prospective-badge">PROSPECTIVE — Nov 2026</span>' : ''}
          ${t.kind === 'committee' ? '<span class="tag">committee staff</span>' : ''}
          ${this.needsVerify(t) ? '<span class="verify-mark" title="Verified before the 120th Congress was seated — re-check assignments">⚠ re-verify</span>' : ''}
          <span class="spacer"></span>
          <span class="status-badge st-${t.status}">${this.STATUSES[t.status] || t.status}</span>
          <span class="prio prio-${t.priority}" title="Priority">${t.priority}</span>
        </div>
        <div class="muted small">${escapeHtml(t.title)}</div>
        <div class="hill-tags">
          ${(t.committees || []).map(c => `<span class="chip">${escapeHtml(c)}</span>`).join('')}
          ${(t.lanes || []).map(l => `<span class="tag">${this.LANES[l] || l}</span>`).join('')}
          ${(t.hooks || []).map(h => `<span class="tag hook-tag">${this.HOOKS[h] || h}</span>`).join('')}
        </div>
      </div>`;
  },

  drawerHtml() {
    const t = Store.state.hillTargets.find(x => x.id === this.ui.selectedId);
    if (!t) return '';
    return `
      <div class="drawer-backdrop" id="hl-drawer-bg"></div>
      <div class="drawer">
        <div class="drawer-head">
          <h2>${escapeHtml(t.name)}</h2>
          <div>
            <button class="tiny" id="hd-copy">Copy liaison brief</button>
            <button class="danger tiny" id="hd-delete">Delete</button>
            <button class="ghost" id="hl-drawer-close">✕</button>
          </div>
        </div>
        <div class="form-row">
          <div style="flex:1;min-width:140px"><label>Name</label><input data-hf="name" value="${escapeHtml(t.name)}"></div>
          <div><label>Party</label><select data-hf="party">
            ${['', 'D', 'R', 'I'].map(p => `<option value="${p}" ${t.party === p || (!t.party && !p) ? 'selected' : ''}>${p || '—'}</option>`).join('')}
          </select></div>
          <div style="width:70px"><label>State</label><input data-hf="state" value="${escapeHtml(t.state || '')}"></div>
        </div>
        <div class="field"><label>Title / office</label><input data-hf="title" value="${escapeHtml(t.title || '')}"></div>
        <div class="form-row">
          <div><label>Status</label><select data-hf="status">
            ${Object.entries(this.STATUSES).map(([k, v]) => `<option value="${k}" ${t.status === k ? 'selected' : ''}>${v}</option>`).join('')}
          </select></div>
          <div><label>Priority</label><select data-hf="priority">
            ${this.PRIORITIES.map(p => `<option value="${p}" ${t.priority === p ? 'selected' : ''}>${p}</option>`).join('')}
          </select></div>
          <div><label>Kind</label><select data-hf="kind">
            ${['member', 'prospective', 'committee'].map(k => `<option value="${k}" ${t.kind === k ? 'selected' : ''}>${k}</option>`).join('')}
          </select></div>
        </div>
        <div class="field"><label>Committees (comma-separated)</label><input id="hd-committees" value="${escapeHtml((t.committees || []).join(', '))}"></div>
        <div class="field"><label>Caucuses (comma-separated)</label><input id="hd-caucuses" value="${escapeHtml((t.caucuses || []).join(', '))}"></div>
        <div class="field"><label>Why them — targeting rationale</label><textarea data-hf="whyThem" rows="4">${escapeHtml(t.whyThem || '')}</textarea></div>
        <div class="field"><label>Narrative — your pitch (edit freely; [brackets] mark gaps to fill)</label><textarea data-hf="narrative" rows="9">${escapeHtml(t.narrative || '')}</textarea></div>
        <div class="field"><label>Notes</label><textarea data-hf="notes" rows="3">${escapeHtml(t.notes || '')}</textarea></div>
        <p class="muted small">Assignments verified ${t.verifiedAt ? fmtDate(t.verifiedAt) : 'never'}${t.sourceNote ? ' — ' + escapeHtml(t.sourceNote) : ''}
          ${this.needsVerify(t) ? ' <span class="verify-mark">⚠ verified under the previous Congress — re-check</span>' : ''}</p>
        <div class="form-row">
          ${t.contactId ? '<button class="tiny" id="hd-open-contact">Open contact</button>' : '<button class="tiny" id="hd-to-contact">Add to contacts</button>'}
          <button class="tiny" id="hd-task">Add follow-up task</button>
          <button class="tiny" id="hd-verify">Mark verified today</button>
        </div>
      </div>`;
  },

  briefText(t) {
    const head = t.name + (t.party ? ' (' + t.party + (t.state ? '-' + t.state : '') + ')' : '') + (t.title ? ' — ' + t.title : '');
    const lines = [head];
    if ((t.committees || []).length) lines.push('Committees: ' + t.committees.join('; '));
    if ((t.caucuses || []).length) lines.push('Caucuses: ' + t.caucuses.join('; '));
    if (t.whyThem) lines.push('Why: ' + t.whyThem);
    if (t.narrative) lines.push('Pitch: ' + t.narrative);
    return lines.join('\n');
  },

  fullBrief() {
    const send = Store.state.hillTargets.filter(t => t.status === 'ready' || t.status === 'sent-to-liaison');
    if (!send.length) return null;
    const groups = [
      ['Prospective offices', send.filter(t => t.kind === 'prospective')],
      ['Senate', send.filter(t => t.kind === 'member' && t.chamber === 'senate')],
      ['House', send.filter(t => t.kind === 'member' && t.chamber === 'house')],
      ['Committee staff', send.filter(t => t.kind === 'committee')]
    ];
    let out = 'CONGRESSIONAL TARGETS (' + fmtDate(todayISO()) + ')\n';
    groups.forEach(([label, items]) => {
      if (!items.length) return;
      out += '\n== ' + label + ' ==\n';
      items.forEach(t => { out += '\n' + this.briefText(t) + '\n'; });
    });
    return out;
  },

  copyText(text, doneMsg) {
    const finish = () => App.flash(doneMsg);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(finish, () => this.copyFallback(text, finish));
    } else this.copyFallback(text, finish);
  },

  copyFallback(text, finish) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); finish(); } catch (e) { alert('Copy failed — select and copy from the drawer.'); }
    ta.remove();
  },

  bind(el) {
    const rerender = () => App.render();

    el.querySelector('#hl-search').addEventListener('input', e => {
      this.ui.search = e.target.value; rerender();
      const s = document.getElementById('hl-search');
      s.focus(); s.setSelectionRange(s.value.length, s.value.length);
    });
    [['#hl-chamber', 'chamber'], ['#hl-lane', 'lane'], ['#hl-hook', 'hook'], ['#hl-status', 'status']].forEach(([sel, key]) => {
      el.querySelector(sel).addEventListener('change', e => { this.ui[key] = e.target.value; rerender(); });
    });
    el.querySelector('#hl-add-btn').addEventListener('click', () => { this.ui.showAdd = !this.ui.showAdd; rerender(); });

    el.querySelector('#hl-brief').addEventListener('click', () => {
      const brief = this.fullBrief();
      if (!brief) { App.flash('No targets marked "Narrative ready" or "With liaison" yet — set statuses first.'); return; }
      this.copyText(brief, 'Liaison brief copied — paste it into your email.');
    });

    const save = el.querySelector('#ha-save');
    if (save) save.addEventListener('click', () => {
      const name = el.querySelector('#ha-name').value.trim();
      if (!name) return;
      Store.state.hillTargets.push({
        id: Store.uid(), kind: el.querySelector('#ha-kind').value,
        name, chamber: el.querySelector('#ha-chamber').value,
        party: el.querySelector('#ha-party').value || null,
        state: el.querySelector('#ha-state').value.trim().toUpperCase(),
        title: '', committees: [], caucuses: [], lanes: [], hooks: [],
        whyThem: '', narrative: '', status: 'researching', priority: 'medium',
        verifiedAt: null, sourceNote: '', notes: '', contactId: null, createdAt: todayISO()
      });
      this.ui.showAdd = false;
      Store.save(); rerender();
    });

    el.querySelectorAll('.hill-card[data-id]').forEach(card => card.addEventListener('click', () => {
      this.ui.selectedId = card.dataset.id; rerender();
    }));

    // Drawer
    const bg = el.querySelector('#hl-drawer-bg');
    if (!bg) return;
    const close = () => { this.ui.selectedId = null; rerender(); };
    bg.addEventListener('click', close);
    el.querySelector('#hl-drawer-close').addEventListener('click', close);

    const t = Store.state.hillTargets.find(x => x.id === this.ui.selectedId);
    el.querySelectorAll('[data-hf]').forEach(input => input.addEventListener('change', () => {
      const v = input.value;
      t[input.dataset.hf] = (input.dataset.hf === 'party' && !v) ? null : v;
      Store.save();
      if (input.tagName === 'SELECT') rerender();
    }));
    el.querySelector('#hd-committees').addEventListener('change', e => {
      t.committees = e.target.value.split(',').map(x => x.trim()).filter(Boolean);
      Store.save();
    });
    el.querySelector('#hd-caucuses').addEventListener('change', e => {
      t.caucuses = e.target.value.split(',').map(x => x.trim()).filter(Boolean);
      Store.save();
    });
    el.querySelector('#hd-copy').addEventListener('click', () => this.copyText(this.briefText(t), 'Brief copied.'));
    el.querySelector('#hd-verify').addEventListener('click', () => {
      t.verifiedAt = todayISO();
      t.sourceNote = 'manually re-verified';
      Store.save(); rerender();
    });
    el.querySelector('#hd-task').addEventListener('click', () => {
      Notes.addTask('Hill: next step on ' + t.name, todayISO());
      Store.save();
      App.flash('Task added (due today) — it’s in the Notes tab.');
    });
    const toContact = el.querySelector('#hd-to-contact');
    if (toContact) toContact.addEventListener('click', () => {
      const parts = t.name.replace(/^(Sen\.|Rep\.|Gov\.)\s+/, '').split(' ');
      const c = Contacts.addContact({
        firstName: parts.slice(0, -1).join(' ') || t.name,
        lastName: parts.slice(-1).join(''),
        company: t.kind === 'committee' ? t.name : 'U.S. ' + (t.chamber === 'senate' ? 'Senate' : 'House'),
        position: t.title, tags: ['hill'], warmth: 'cold', notes: t.whyThem
      });
      t.contactId = c.id;
      Store.save(); rerender();
      App.flash('Added to Contacts (tagged hill).');
    });
    const openContact = el.querySelector('#hd-open-contact');
    if (openContact) openContact.addEventListener('click', () => {
      Contacts.ui.selectedId = t.contactId;
      App.setTab('contacts');
    });
    el.querySelector('#hd-delete').addEventListener('click', () => {
      if (!confirm('Delete this target?')) return;
      Store.state.hillTargets = Store.state.hillTargets.filter(x => x.id !== t.id);
      this.ui.selectedId = null;
      Store.save(); rerender();
    });
  }
};
