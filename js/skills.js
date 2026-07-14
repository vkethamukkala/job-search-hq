/* Skills — career skill tracker: tools, languages, certs. Each skill carries a
   milestone checklist (drives the progress meter), a dated progress log, and
   links to the stories that evidence it (matched on Stories' skills[] tags). */

const Skills = {
  LEVELS: { learning: 'Learning', comfortable: 'Comfortable', proficient: 'Proficient', expert: 'Expert' },
  ui: { search: '', category: '', showAdd: false, showCats: false, selectedId: null },

  categories() {
    return Store.state.settings.skillCategories;
  },

  /* Milestone completion; null when there are none (card falls back to level). */
  progress(sk) {
    const ms = sk.milestones || [];
    if (!ms.length) return null;
    const done = ms.filter(m => m.done).length;
    return { done, total: ms.length, pct: Math.round((done / ms.length) * 100) };
  },

  /* Stories whose skills[] tags name this skill (exact, case-insensitive —
     not includes(), so a skill named "R" doesn't match everything). */
  linkedStories(sk) {
    const name = (sk.name || '').trim().toLowerCase();
    if (!name) return [];
    return Store.state.stories.filter(s =>
      (s.skills || []).some(t => t.trim().toLowerCase() === name));
  },

  filtered() {
    const q = this.ui.search.trim().toLowerCase();
    return Store.state.skills.filter(sk => {
      if (this.ui.category === 'none') { if (sk.category) return false; }
      else if (this.ui.category && sk.category !== this.ui.category) return false;
      if (!q) return true;
      return [sk.name, sk.category, sk.goal, sk.notes].join(' ').toLowerCase().includes(q);
    }).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  },

  /* Groups in settings order; skills with '' or a removed category fall into
     a trailing Uncategorized group. */
  grouped(list) {
    const cats = this.categories();
    const groups = cats.map(cat => ({ cat, skills: list.filter(sk => sk.category === cat) }));
    groups.push({ cat: '', skills: list.filter(sk => !cats.includes(sk.category)) });
    return groups.filter(g => g.skills.length);
  },

  render() {
    const el = document.getElementById('tab-skills');
    const list = this.filtered();
    const n = Store.state.skills.length;

    el.innerHTML = `
      <div class="toolbar">
        <input type="search" id="sk-search" placeholder="Search skills…" value="${escapeHtml(this.ui.search)}" style="min-width:200px">
        <select id="sk-cat-filter">
          <option value="">All categories</option>
          ${this.categories().map(c => `<option value="${escapeHtml(c)}" ${this.ui.category === c ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
          <option value="none" ${this.ui.category === 'none' ? 'selected' : ''}>Uncategorized</option>
        </select>
        <span class="muted small">${n} ${n === 1 ? 'skill' : 'skills'} tracked</span>
        <span class="spacer"></span>
        <button class="ghost" id="sk-cats-btn">Manage categories</button>
        <button class="primary" id="sk-add-btn">+ Add skill</button>
      </div>
      ${this.catManagerHtml()}
      ${this.addFormHtml()}
      ${n === 0 ? `<div class="card"><div class="empty-state">
          <b style="color:var(--ink)">Skills compound — even 30 minutes counts.</b><br><br>
          Track what you're learning (PowerBI, Tableau, SQL, a cert…), break it into
          milestones, and log each session so the progress is visible when motivation isn't.<br><br>
          Hit <b style="color:var(--ink)">+ Add skill</b> to start.
        </div></div>`
        : (list.length
          ? this.grouped(list).map(g => `
            <div class="skill-group">
              <h3>${g.cat ? escapeHtml(g.cat) : 'Uncategorized'} <span class="muted small">· ${g.skills.length}</span></h3>
              <div class="skill-grid">${g.skills.map(sk => this.cardHtml(sk)).join('')}</div>
            </div>`).join('')
          : '<div class="card"><div class="empty-state">No skills match the current filters.</div></div>')}
      ${this.drawerHtml()}
    `;
    this.bind(el);
  },

  catManagerHtml() {
    return `<div class="card section-gap ${this.ui.showCats ? '' : 'hidden'}" id="sk-cats-panel">
      <h2>Skill categories</h2>
      <p class="muted small">Skills are grouped under these on the page. Deleting a category keeps its skills — they just become uncategorized.</p>
      <div class="form-row">
        ${this.categories().map(c => `<span class="tag">${escapeHtml(c)}
          <button class="ghost tiny" data-cat-del="${escapeHtml(c)}" title="Remove category">✕</button></span>`).join('')}
      </div>
      <div class="form-row">
        <input id="sk-cat-new" placeholder="New category…" style="min-width:180px">
        <button class="tiny" id="sk-cat-add">+ Add category</button>
      </div>
    </div>`;
  },

  addFormHtml() {
    return `<div class="card section-gap ${this.ui.showAdd ? '' : 'hidden'}" id="sk-add-panel">
      <h2>Add a skill</h2>
      <div class="form-row">
        <div style="flex:1;min-width:180px"><label>Skill</label><input id="ka-name" placeholder="e.g. PowerBI"></div>
        <div><label>Category</label><select id="ka-cat">
          ${this.categories().map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}
          <option value="">Uncategorized</option>
        </select></div>
        <div><label>Level today</label><select id="ka-level">
          ${Object.entries(this.LEVELS).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
        </select></div>
      </div>
      <div class="form-row">
        <div style="flex:1;min-width:200px"><label>Goal (what & by when)</label><input id="ka-goal" placeholder="e.g. PL-300 cert by September"></div>
        <div><button class="primary" id="ka-save">Save skill</button></div>
      </div>
    </div>`;
  },

  cardHtml(sk) {
    const p = this.progress(sk);
    const logs = (sk.log || []).length;
    return `<div class="skill-card" data-id="${sk.id}">
      <div class="who">${escapeHtml(sk.name)}
        <span class="tag" style="float:right">${this.LEVELS[sk.level] || 'Learning'}</span></div>
      ${p ? `<div class="meter thin ${p.pct === 100 ? 'met' : ''}" style="margin-top:10px"><span style="width:${p.pct}%"></span></div>
             <div class="muted small" style="margin-top:4px">${p.done}/${p.total} milestones · ${p.pct}%</div>`
          : `<div class="muted small" style="margin-top:10px">No milestones yet</div>`}
      <div class="muted small" style="margin-top:6px">
        ${logs} log ${logs === 1 ? 'entry' : 'entries'}${sk.goal ? ` · 🎯 ${escapeHtml(sk.goal)}` : ''}
      </div>
    </div>`;
  },

  drawerHtml() {
    const sk = Store.state.skills.find(x => x.id === this.ui.selectedId);
    if (!sk) return '';
    const cats = this.categories();
    const ms = sk.milestones || [];
    const log = (sk.log || []).slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const stories = this.linkedStories(sk);
    const p = this.progress(sk);

    return `
      <div class="drawer-backdrop" id="sk-drawer-bg"></div>
      <div class="drawer">
        <div class="drawer-head">
          <h2>${escapeHtml(sk.name)}</h2>
          <div>
            <button class="danger tiny" id="kd-delete">Delete</button>
            <button class="ghost" id="sk-drawer-close">✕</button>
          </div>
        </div>
        <div class="field"><label>Skill</label><input data-kf="name" value="${escapeHtml(sk.name)}"></div>
        <div class="grid grid-2">
          <div class="field"><label>Category</label><select data-kf="category">
            ${sk.category && !cats.includes(sk.category) ? `<option value="${escapeHtml(sk.category)}" selected>${escapeHtml(sk.category)} (removed)</option>` : ''}
            ${cats.map(c => `<option value="${escapeHtml(c)}" ${sk.category === c ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
            <option value="" ${!sk.category ? 'selected' : ''}>Uncategorized</option>
          </select></div>
          <div class="field"><label>Level</label><select data-kf="level">
            ${Object.entries(this.LEVELS).map(([v, l]) => `<option value="${v}" ${sk.level === v ? 'selected' : ''}>${l}</option>`).join('')}
          </select></div>
        </div>
        <div class="field"><label>Goal</label><input data-kf="goal" value="${escapeHtml(sk.goal || '')}" placeholder="What & by when"></div>
        <div class="field"><label>Notes</label><textarea data-kf="notes" rows="2" placeholder="Resources, course links, context…">${escapeHtml(sk.notes || '')}</textarea></div>

        <h2 style="margin-top:14px">Milestones ${p ? `<span class="muted small">· ${p.done}/${p.total}</span>` : ''}</h2>
        ${ms.map(m => `<div class="ms-row ${m.done ? 'done' : ''}">
          <input type="checkbox" data-ms-toggle="${m.id}" ${m.done ? 'checked' : ''}>
          <span>${escapeHtml(m.text)}</span>
          <button class="ghost tiny" data-ms-del="${m.id}" title="Remove milestone">✕</button>
        </div>`).join('') || '<p class="muted small">Break the skill into steps — each one you check moves the meter.</p>'}
        <div class="form-row" style="margin-top:6px">
          <input id="kd-ms-text" placeholder="e.g. Finish DAX fundamentals module" style="flex:1;min-width:180px">
          <button class="tiny" id="kd-ms-add">+ Add</button>
        </div>

        <h2 style="margin-top:14px">Progress log</h2>
        <div class="form-row">
          <input type="date" id="kd-log-date" value="${todayISO()}">
          <input id="kd-log-text" placeholder="What did you do or learn?" style="flex:1;min-width:160px">
          <button class="tiny" id="kd-log-add">+ Log</button>
        </div>
        ${log.map(e => `<div class="log-row">
          <span class="muted small" style="white-space:nowrap">${fmtDate(e.date)}</span>
          <span style="flex:1">${escapeHtml(e.text)}</span>
          <button class="ghost tiny" data-log-del="${e.id}" title="Remove entry">✕</button>
        </div>`).join('') || '<p class="muted small">No entries yet — log sessions as you go so progress stays visible.</p>'}

        <h2 style="margin-top:14px">Linked stories</h2>
        ${stories.length
          ? stories.map(s => `<div class="log-row"><span style="flex:1">${escapeHtml(s.title)}</span>
              <span class="muted small" style="white-space:nowrap">${Stories.SOURCES[s.source] || ''}</span></div>`).join('')
          : `<p class="muted small">No story evidences this skill yet — tag a story with
             “${escapeHtml(sk.name)}” on the Stories tab so interviews and the ATS matcher can use it.</p>`}
        <p class="muted small" style="margin-top:10px">Added ${fmtDate(sk.createdAt)}</p>
      </div>`;
  },

  bind(el) {
    el.querySelector('#sk-search').addEventListener('input', e => {
      this.ui.search = e.target.value;
      App.render();
      const i = document.getElementById('sk-search');
      i.focus(); i.setSelectionRange(i.value.length, i.value.length);
    });
    el.querySelector('#sk-cat-filter').addEventListener('change', e => { this.ui.category = e.target.value; App.render(); });
    el.querySelector('#sk-add-btn').addEventListener('click', () => { this.ui.showAdd = !this.ui.showAdd; App.render(); });
    el.querySelector('#sk-cats-btn').addEventListener('click', () => { this.ui.showCats = !this.ui.showCats; App.render(); });

    // Category manager
    el.querySelector('#sk-cat-add').addEventListener('click', () => {
      const inp = el.querySelector('#sk-cat-new');
      const name = inp.value.trim();
      if (!name) return;
      if (this.categories().some(c => c.toLowerCase() === name.toLowerCase())) { alert('That category already exists.'); return; }
      this.categories().push(name);
      Store.save(); App.render();
    });
    el.querySelectorAll('[data-cat-del]').forEach(btn => btn.addEventListener('click', e => {
      e.stopPropagation();
      const cat = btn.dataset.catDel;
      const affected = Store.state.skills.filter(sk => sk.category === cat);
      const msg = affected.length
        ? `Remove the "${cat}" category? ${affected.length} skill${affected.length === 1 ? '' : 's'} will move to Uncategorized.`
        : `Remove the "${cat}" category?`;
      if (!confirm(msg)) return;
      Store.state.settings.skillCategories = this.categories().filter(c => c !== cat);
      affected.forEach(sk => { sk.category = ''; });
      if (this.ui.category === cat) this.ui.category = '';
      Store.save(); App.render();
    }));

    // Add skill
    const save = el.querySelector('#ka-save');
    if (save) save.addEventListener('click', () => {
      const name = el.querySelector('#ka-name').value.trim();
      if (!name) { alert('Give the skill a name.'); return; }
      Store.state.skills.push({
        id: Store.uid(),
        name,
        category: el.querySelector('#ka-cat').value,
        level: el.querySelector('#ka-level').value,
        goal: el.querySelector('#ka-goal').value.trim(),
        notes: '',
        milestones: [],
        log: [],
        createdAt: todayISO()
      });
      this.ui.showAdd = false;
      Store.save(); App.render();
      App.flash('Skill added — break it into milestones and log as you go.');
    });

    el.querySelectorAll('.skill-card[data-id]').forEach(card => card.addEventListener('click', () => {
      this.ui.selectedId = card.dataset.id; App.render();
    }));

    // Drawer
    const bg = el.querySelector('#sk-drawer-bg');
    if (!bg) return;
    const close = () => { this.ui.selectedId = null; App.render(); };
    bg.addEventListener('click', close);
    el.querySelector('#sk-drawer-close').addEventListener('click', close);

    const sk = Store.state.skills.find(x => x.id === this.ui.selectedId);
    el.querySelectorAll('[data-kf]').forEach(input => input.addEventListener('change', () => {
      sk[input.dataset.kf] = input.value;
      Store.save();
      if (input.tagName === 'SELECT') App.render(); // category/level show on the card & grouping
    }));

    // Milestones
    el.querySelector('#kd-ms-add').addEventListener('click', () => {
      const inp = el.querySelector('#kd-ms-text');
      const text = inp.value.trim();
      if (!text) return;
      sk.milestones = sk.milestones || [];
      sk.milestones.push({ id: Store.uid(), text, done: false });
      Store.save(); App.render();
    });
    el.querySelector('#kd-ms-text').addEventListener('keydown', e => {
      if (e.key === 'Enter') el.querySelector('#kd-ms-add').click();
    });
    el.querySelectorAll('[data-ms-toggle]').forEach(cb => cb.addEventListener('change', () => {
      const m = (sk.milestones || []).find(x => x.id === cb.dataset.msToggle);
      if (m) { m.done = cb.checked; Store.save(); App.render(); }
    }));
    el.querySelectorAll('[data-ms-del]').forEach(btn => btn.addEventListener('click', () => {
      sk.milestones = (sk.milestones || []).filter(x => x.id !== btn.dataset.msDel);
      Store.save(); App.render();
    }));

    // Progress log
    el.querySelector('#kd-log-add').addEventListener('click', () => {
      const text = el.querySelector('#kd-log-text').value.trim();
      if (!text) return;
      sk.log = sk.log || [];
      sk.log.push({ id: Store.uid(), date: el.querySelector('#kd-log-date').value || todayISO(), text });
      Store.save(); App.render();
    });
    el.querySelector('#kd-log-text').addEventListener('keydown', e => {
      if (e.key === 'Enter') el.querySelector('#kd-log-add').click();
    });
    el.querySelectorAll('[data-log-del]').forEach(btn => btn.addEventListener('click', () => {
      sk.log = (sk.log || []).filter(x => x.id !== btn.dataset.logDel);
      Store.save(); App.render();
    }));

    el.querySelector('#kd-delete').addEventListener('click', () => {
      if (!confirm('Delete this skill and its milestones and log?')) return;
      Store.state.skills = Store.state.skills.filter(x => x.id !== sk.id);
      this.ui.selectedId = null;
      Store.save(); App.render();
    });
  }
};
