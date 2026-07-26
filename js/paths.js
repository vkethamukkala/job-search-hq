/* Paths — career options compared on one timeline. Each path (keep job
   searching, grad school, study abroad, freelance…) is a row of milestone
   bars over a shared month axis; next steps become real tasks (pathId). */

const Paths = {
  STATUSES: { active: 'Active', exploring: 'Exploring', idea: 'Idea', dropped: 'Dropped' },
  STATUS_ORDER: ['active', 'exploring', 'idea', 'dropped'],
  COLORS: { blue: 'Blue', green: 'Green', amber: 'Amber', violet: 'Violet' },
  LANE_H: 26,
  ui: { showAdd: false, showDropped: false, selectedId: null },

  /* One-time seed of the four options under consideration (guarded so user
     edits and deletions stick). Dates are examples relative to this month. */
  ensureSeed() {
    if (Store.state.settings.seededPaths) return;
    const s = Store.state.settings;
    const base = monthStartISO(todayISO());
    const M = n => addMonthsISO(base, n);                        // first of month n from now
    const Mend = n => addDaysISO(addMonthsISO(base, n + 1), -1); // last day of month n
    const ms = (label, start, end) => ({ id: Store.uid(), label, start, end: end || null, done: false });
    const path = (name, color, status, pros, cons, milestones) =>
      ({ id: Store.uid(), name, color, status, pros, cons, notes: '', milestones, createdAt: todayISO() });

    Store.state.careerPaths.push(
      path('Job search', 'blue', 'active',
        'Income soonest; momentum and network already built',
        'Slow market; emotionally taxing',
        [ms('90-day push', s.startDate, s.endDate), ms('Decision checkpoint', s.endDate)]),
      path('Grad school', 'violet', 'exploring',
        'Career pivot; credential; time to retool',
        'Cost; 2 years; applications are their own job',
        [ms('GRE prep', M(1), Mend(3)), ms('Applications', M(4), addDaysISO(M(5), 14)),
         ms('Decisions', M(8), addDaysISO(M(9), 14)), ms('Start Fall term', M(14))]),
      path('Study abroad', 'green', 'exploring',
        'Adventure; language; global network',
        'Visa work; cost; far from home base',
        [ms('Research programs', M(1), Mend(2)), ms('Language & visa prep', M(3), Mend(6)),
         ms('Apply', M(7), Mend(8)), ms('Depart', M(13))]),
      path('Freelance writing', 'amber', 'idea',
        'Flexible; compounds the writing portfolio',
        'Unstable income; slow ramp',
        [ms('Portfolio pieces', M(1), Mend(2)), ms('First pitches', M(3), Mend(4)),
         ms('3 paid clips', addDaysISO(M(6), 14))])
    );
    s.seededPaths = true;
    Store.save();
  },

  /* ---------- timeline math ---------- */

  axis() {
    const start = monthStartISO(todayISO());
    const months = Number(Store.state.settings.pathsHorizonMonths) || 18;
    const end = addMonthsISO(start, months);
    return { start, end, months, total: daysBetween(start, end) };
  },

  pct(iso, ax) {
    return Math.min(100, Math.max(0, (daysBetween(ax.start, iso) / ax.total) * 100));
  },

  /* Greedy first-fit lane packing so overlapping milestones stack instead of
     drawing over each other. Returns placed entries + lane count. */
  lanes(milestones) {
    const sorted = milestones.slice().sort((a, b) => (a.start || '').localeCompare(b.start || ''));
    const laneEnds = [];
    const placed = sorted.map(m => {
      const end = m.end || m.start;
      let lane = laneEnds.findIndex(le => le < m.start);
      if (lane === -1) { lane = laneEnds.length; laneEnds.push(end); }
      else laneEnds[lane] = end;
      return { m, lane };
    });
    return { placed, count: Math.max(1, laneEnds.length) };
  },

  msState(m, t) {
    if (m.done) return 'done';
    const end = m.end || m.start;
    if (end < t) return 'past';
    if (m.start <= t) return 'current';
    return 'upcoming';
  },

  openTasks(p) {
    return Store.state.tasks.filter(x => x.pathId === p.id && !x.done);
  },

  visiblePaths() {
    const order = this.STATUS_ORDER;
    return Store.state.careerPaths
      .filter(p => this.ui.showDropped || p.status !== 'dropped')
      .slice()
      .sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status) ||
        (a.name || '').localeCompare(b.name || ''));
  },

  /* ---------- render ---------- */

  render() {
    const el = document.getElementById('tab-paths');
    const n = Store.state.careerPaths.length;
    const dropped = Store.state.careerPaths.filter(p => p.status === 'dropped').length;
    const horizon = Number(Store.state.settings.pathsHorizonMonths) || 18;

    el.innerHTML = `
      <div class="toolbar">
        <div><label>Horizon</label><select id="pa-horizon">
          ${[12, 18, 24].map(m => `<option value="${m}" ${horizon === m ? 'selected' : ''}>${m} months</option>`).join('')}
        </select></div>
        ${dropped ? `<label class="prep-check" style="margin:0"><input type="checkbox" id="pa-dropped" ${this.ui.showDropped ? 'checked' : ''}>
          <span class="muted small">Show dropped (${dropped})</span></label>` : ''}
        <span class="muted small">${n} ${n === 1 ? 'path' : 'paths'}</span>
        <span class="spacer"></span>
        <button class="primary" id="pa-add-btn">+ Add path</button>
      </div>
      ${this.addFormHtml()}
      ${n === 0 ? `<div class="card"><div class="empty-state">
          <b style="color:var(--ink)">Every option deserves a timeline.</b><br><br>
          Map each direction you're weighing — keep searching, grad school, a move,
          freelancing — as milestones on one calendar, so "someday" ideas become
          comparable plans. Hit <b style="color:var(--ink)">+ Add path</b> to start.
        </div></div>`
        : this.timelineHtml()}
      ${this.drawerHtml()}
    `;
    this.bind(el);
  },

  addFormHtml() {
    return `<div class="card section-gap ${this.ui.showAdd ? '' : 'hidden'}">
      <h2>Add a path</h2>
      <div class="form-row">
        <div style="flex:1;min-width:180px"><label>Path</label><input id="pa-name" placeholder="e.g. Policy fellowship"></div>
        <div><label>Status</label><select id="pa-status">
          ${Object.entries(this.STATUSES).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
        </select></div>
        <div><label>Color</label><select id="pa-color">
          ${Object.entries(this.COLORS).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
        </select></div>
        <div><button class="primary" id="pa-save">Save path</button></div>
      </div>
      <p class="muted small">Open the path afterwards to add milestones, pros & cons, and next steps.</p>
    </div>`;
  },

  timelineHtml() {
    const ax = this.axis();
    const t = todayISO();
    const paths = this.visiblePaths();
    const labelStep = ax.months > 12 ? 2 : 1;

    let header = '';
    for (let i = 0; i < ax.months; i++) {
      const mISO = addMonthsISO(ax.start, i);
      const left = this.pct(mISO, ax);
      if (i > 0) header += `<div class="paths-gridline" style="left:${left}%"></div>`;
      if (i % labelStep === 0) {
        const d = parseISO(mISO);
        let lbl = d.toLocaleDateString(undefined, { month: 'short' });
        if (i === 0 || d.getMonth() === 0) lbl += ' ’' + String(d.getFullYear()).slice(2);
        header += `<div class="paths-month-label" style="left:${left}%">${lbl}</div>`;
      }
    }

    return `<div class="card">
      <div class="paths-scroll"><div class="paths-board">
        <div class="path-row paths-header">
          <div class="path-label"></div>
          <div class="path-track" style="height:20px">${header}</div>
        </div>
        ${paths.map(p => this.rowHtml(p, ax, t)).join('')}
      </div></div>
      <p class="muted small" style="margin-top:10px">Click a path to edit milestones, weigh pros & cons, and queue next steps as tasks.</p>
    </div>`;
  },

  rowHtml(p, ax, t) {
    const inWindow = (p.milestones || []).filter(m =>
      (m.end || m.start) >= ax.start && m.start <= ax.end && m.start);
    const { placed, count } = this.lanes(inWindow);
    const height = count * this.LANE_H + 6;

    let track = '';
    for (let i = 1; i < ax.months; i++) {
      track += `<div class="paths-gridline" style="left:${this.pct(addMonthsISO(ax.start, i), ax)}%"></div>`;
    }
    track += `<div class="paths-today" style="left:${this.pct(t, ax)}%"></div>`;
    track += placed.map(({ m, lane }) => this.msHtml(m, p, ax, lane, t)).join('');

    return `<div class="path-row path-${p.color} ${p.status === 'dropped' ? 'is-dropped' : ''}" data-id="${p.id}">
      <div class="path-label">
        <div class="who"><span class="path-swatch"></span>${escapeHtml(p.name)}</div>
        <div class="path-status">${this.STATUSES[p.status] || ''}${this.openTasks(p).length
          ? ` · ${this.openTasks(p).length} open task${this.openTasks(p).length === 1 ? '' : 's'}` : ''}</div>
      </div>
      <div class="path-track" style="height:${height}px">${track}</div>
    </div>`;
  },

  msHtml(m, p, ax, lane, t) {
    const state = this.msState(m, t);
    const top = lane * this.LANE_H + 3;
    const left = this.pct(m.start, ax);
    const title = escapeHtml(m.label) + ' · ' + fmtDate(m.start) + (m.end ? ' – ' + fmtDate(m.end) : '');
    if (!m.end) {
      const flip = left > 85; // label to the left near the axis edge
      return `<div class="path-dot ${state}" style="left:${left}%;top:${top + 5}px" title="${title}"></div>
        <div class="path-dot-label ${flip ? 'flip' : ''}" style="left:${left}%;top:${top}px">${escapeHtml(m.label)}</div>`;
    }
    const width = Math.max(this.pct(addDaysISO(m.end, 1), ax) - left, 1.5);
    const clipped = m.end > ax.end;
    return `<div class="path-bar ${state} ${clipped ? 'clipped' : ''}"
      style="left:${left}%;width:${width}%;top:${top}px" title="${title}">${state === 'done' ? '✓ ' : ''}${escapeHtml(m.label)}</div>`;
  },

  /* ---------- drawer ---------- */

  drawerHtml() {
    const p = Store.state.careerPaths.find(x => x.id === this.ui.selectedId);
    if (!p) return '';
    const ms = (p.milestones || []).slice().sort((a, b) => (a.start || '').localeCompare(b.start || ''));
    const open = this.openTasks(p);
    const doneCount = Store.state.tasks.filter(x => x.pathId === p.id && x.done).length;

    return `
      <div class="drawer-backdrop" id="pd-bg"></div>
      <div class="drawer path-${p.color}">
        <div class="drawer-head">
          <h2><span class="path-swatch"></span> ${escapeHtml(p.name)}</h2>
          <div>
            <button class="danger tiny" id="pd-delete">Delete</button>
            <button class="ghost" id="pd-close">✕</button>
          </div>
        </div>
        <div class="field"><label>Path</label><input data-pf="name" value="${escapeHtml(p.name)}"></div>
        <div class="grid grid-2">
          <div class="field"><label>Status</label><select data-pf="status">
            ${Object.entries(this.STATUSES).map(([v, l]) => `<option value="${v}" ${p.status === v ? 'selected' : ''}>${l}</option>`).join('')}
          </select></div>
          <div class="field"><label>Color</label><select data-pf="color">
            ${Object.entries(this.COLORS).map(([v, l]) => `<option value="${v}" ${p.color === v ? 'selected' : ''}>${l}</option>`).join('')}
          </select></div>
        </div>
        <div class="grid grid-2">
          <div class="field"><label>Pros</label><textarea data-pf="pros" rows="2" placeholder="What pulls you toward this?">${escapeHtml(p.pros || '')}</textarea></div>
          <div class="field"><label>Cons</label><textarea data-pf="cons" rows="2" placeholder="What gives you pause?">${escapeHtml(p.cons || '')}</textarea></div>
        </div>
        <div class="field"><label>Notes</label><textarea data-pf="notes" rows="2" placeholder="Programs, links, people to ask…">${escapeHtml(p.notes || '')}</textarea></div>

        <h2 style="margin-top:14px">Milestones</h2>
        ${ms.map(m => `<div class="form-row pd-ms-row ${m.done ? 'done' : ''}" style="align-items:flex-end">
          <input type="checkbox" data-pm-done="${m.id}" ${m.done ? 'checked' : ''} title="Done" style="margin-bottom:8px">
          <div style="flex:1;min-width:130px"><label>Milestone</label><input data-pm-label="${m.id}" value="${escapeHtml(m.label)}"></div>
          <div><label>Start</label><input type="date" data-pm-start="${m.id}" value="${m.start || ''}"></div>
          <div><label>End <span class="muted">(blank = point)</span></label><input type="date" data-pm-end="${m.id}" value="${m.end || ''}"></div>
          <div><button class="ghost tiny" data-pm-del="${m.id}" title="Remove milestone">✕</button></div>
        </div>`).join('') || '<p class="muted small">Sketch the phases: research → apply → decide → start. Leave End blank for a single-date checkpoint.</p>'}
        <div class="form-row" style="margin-top:6px;align-items:flex-end">
          <div style="flex:1;min-width:130px"><label>New milestone</label><input id="pd-ms-label" placeholder="e.g. Applications"></div>
          <div><label>Start</label><input type="date" id="pd-ms-start" value="${todayISO()}"></div>
          <div><label>End</label><input type="date" id="pd-ms-end"></div>
          <div><button class="tiny" id="pd-ms-add">+ Add</button></div>
        </div>

        <h2 style="margin-top:14px">Next steps <span class="muted small">· real tasks, shown on the Notes tab</span></h2>
        <div class="form-row">
          <input id="pd-task-text" placeholder="Concrete next action…" style="flex:1;min-width:160px">
          <input type="date" id="pd-task-due" title="Due date (optional)">
          <button class="tiny" id="pd-task-add">+ Add task</button>
        </div>
        ${open.map(x => `<div class="ms-row">
          <input type="checkbox" data-pt-toggle="${x.id}">
          <span>${escapeHtml(x.text)}${x.dueDate ? ` <span class="muted small">· due ${fmtDate(x.dueDate)}</span>` : ''}</span>
        </div>`).join('') || '<p class="muted small">No open tasks for this path yet.</p>'}
        ${doneCount ? `<p class="muted small">${doneCount} completed</p>` : ''}
        <p class="muted small" style="margin-top:10px">Added ${fmtDate(p.createdAt)}</p>
      </div>`;
  },

  /* ---------- events ---------- */

  bind(el) {
    el.querySelector('#pa-horizon').addEventListener('change', e => {
      Store.state.settings.pathsHorizonMonths = Number(e.target.value) || 18;
      Store.save(); App.render();
    });
    const droppedCb = el.querySelector('#pa-dropped');
    if (droppedCb) droppedCb.addEventListener('change', e => { this.ui.showDropped = e.target.checked; App.render(); });
    el.querySelector('#pa-add-btn').addEventListener('click', () => { this.ui.showAdd = !this.ui.showAdd; App.render(); });

    const save = el.querySelector('#pa-save');
    if (save) save.addEventListener('click', () => {
      const name = el.querySelector('#pa-name').value.trim();
      if (!name) { alert('Give the path a name.'); return; }
      const p = {
        id: Store.uid(), name,
        color: el.querySelector('#pa-color').value,
        status: el.querySelector('#pa-status').value,
        pros: '', cons: '', notes: '', milestones: [], createdAt: todayISO()
      };
      Store.state.careerPaths.push(p);
      this.ui.showAdd = false;
      this.ui.selectedId = p.id;
      Store.save(); App.render();
    });

    el.querySelectorAll('.path-row[data-id]').forEach(row => row.addEventListener('click', () => {
      this.ui.selectedId = row.dataset.id; App.render();
    }));

    // Drawer
    const bg = el.querySelector('#pd-bg');
    if (!bg) return;
    const close = () => { this.ui.selectedId = null; App.render(); };
    bg.addEventListener('click', close);
    el.querySelector('#pd-close').addEventListener('click', close);

    const p = Store.state.careerPaths.find(x => x.id === this.ui.selectedId);
    el.querySelectorAll('[data-pf]').forEach(input => input.addEventListener('change', () => {
      p[input.dataset.pf] = input.value;
      Store.save(); App.render();
    }));

    // Milestones (keyed by id; start/end swapped on save if inverted)
    const findMs = id => (p.milestones || []).find(x => x.id === id);
    const fixOrder = m => { if (m.end && m.start && m.end < m.start) { const s = m.start; m.start = m.end; m.end = s; } };
    el.querySelectorAll('[data-pm-label]').forEach(inp => inp.addEventListener('change', () => {
      const m = findMs(inp.dataset.pmLabel); if (m) { m.label = inp.value.trim(); Store.save(); App.render(); }
    }));
    el.querySelectorAll('[data-pm-start]').forEach(inp => inp.addEventListener('change', () => {
      const m = findMs(inp.dataset.pmStart); if (m) { m.start = inp.value || m.start; fixOrder(m); Store.save(); App.render(); }
    }));
    el.querySelectorAll('[data-pm-end]').forEach(inp => inp.addEventListener('change', () => {
      const m = findMs(inp.dataset.pmEnd); if (m) { m.end = inp.value || null; fixOrder(m); Store.save(); App.render(); }
    }));
    el.querySelectorAll('[data-pm-done]').forEach(cb => cb.addEventListener('change', () => {
      const m = findMs(cb.dataset.pmDone); if (m) { m.done = cb.checked; Store.save(); App.render(); }
    }));
    el.querySelectorAll('[data-pm-del]').forEach(btn => btn.addEventListener('click', () => {
      p.milestones = (p.milestones || []).filter(x => x.id !== btn.dataset.pmDel);
      Store.save(); App.render();
    }));
    el.querySelector('#pd-ms-add').addEventListener('click', () => {
      const label = el.querySelector('#pd-ms-label').value.trim();
      const start = el.querySelector('#pd-ms-start').value;
      if (!label || !start) { alert('A milestone needs a name and a start date.'); return; }
      const m = { id: Store.uid(), label, start, end: el.querySelector('#pd-ms-end').value || null, done: false };
      fixOrder(m);
      p.milestones = p.milestones || [];
      p.milestones.push(m);
      Store.save(); App.render();
    });
    el.querySelector('#pd-ms-label').addEventListener('keydown', e => {
      if (e.key === 'Enter') el.querySelector('#pd-ms-add').click();
    });

    // Next steps → real tasks
    el.querySelector('#pd-task-add').addEventListener('click', () => {
      const text = el.querySelector('#pd-task-text').value.trim();
      if (!text) return;
      Notes.addTask(text, el.querySelector('#pd-task-due').value, p.id);
      Store.save(); App.render();
    });
    el.querySelector('#pd-task-text').addEventListener('keydown', e => {
      if (e.key === 'Enter') el.querySelector('#pd-task-add').click();
    });
    el.querySelectorAll('[data-pt-toggle]').forEach(cb => cb.addEventListener('change', () => {
      const x = Store.state.tasks.find(y => y.id === cb.dataset.ptToggle);
      if (x) { x.done = cb.checked; x.doneAt = cb.checked ? todayISO() : null; Store.save(); App.render(); }
    }));

    el.querySelector('#pd-delete').addEventListener('click', () => {
      const linked = Store.state.tasks.filter(x => x.pathId === p.id);
      const msg = linked.length
        ? `Delete "${p.name}" and its milestones? Its ${linked.length} linked task${linked.length === 1 ? '' : 's'} will stay on the Notes tab, just untagged.`
        : `Delete "${p.name}" and its milestones?`;
      if (!confirm(msg)) return;
      linked.forEach(x => { x.pathId = null; });
      Store.state.careerPaths = Store.state.careerPaths.filter(x => x.id !== p.id);
      this.ui.selectedId = null;
      Store.save(); App.render();
    });
  }
};
