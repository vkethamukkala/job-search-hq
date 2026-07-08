/* Stories — STAR-lite evidence bank: capture wins with skill tags, feed the
   ATS matcher (gap → story link) and meeting prep (stories to have ready). */

const Stories = {
  PROMPTS: [
    'What broke, and what did you do about it?',
    'What did you teach yourself under a deadline?',
    'When did someone senior rely on you for something?',
    'What would have gone worse if you hadn’t been there?',
    'What did you do that was outside your job description?',
    'What process did you make faster, cheaper, or less painful?',
    'When did you change someone’s mind with evidence?',
    'What did you ship, publish, or present — even internally?',
    'What mistake did you catch before it became a problem?',
    'When did you get a customer, user, or colleague unstuck?',
    'What number did you move, even slightly? (time saved, errors cut, signups)',
    'What did a manager or peer compliment you on — and what was behind it?'
  ],
  SOURCES: { job: 'At my job', search: 'During the search', project: 'Side project' },
  ui: { search: '', skill: '', showAdd: false, selectedId: null, promptIdx: 0 },

  storyText(s) {
    return [s.title, s.situation, s.action, s.result, (s.skills || []).join(' ')].join(' ').toLowerCase();
  },

  /* Does any story back up this keyword? Used by the ATS matcher. */
  matchingKeyword(term) {
    const t = term.toLowerCase();
    return Store.state.stories.filter(s =>
      (s.skills || []).some(k => k.toLowerCase().includes(t) || t.includes(k.toLowerCase())) ||
      this.storyText(s).includes(t)
    );
  },

  /* Top 3 stories for a meeting, scored by overlap with its contact/application context. */
  relevantFor(meeting) {
    const contact = Store.state.contacts.find(c => c.id === meeting.contactId);
    const app = Store.state.applications.find(a => a.id === meeting.applicationId);
    const context = [
      contact && contact.company, contact && contact.position,
      app && app.company, app && app.role, meeting.type
    ].filter(Boolean).join(' ').toLowerCase().split(/[^a-z0-9+#]+/).filter(w => w.length > 2);

    const scored = Store.state.stories.map(s => {
      const text = this.storyText(s);
      let score = 0;
      for (const w of context) if (text.includes(w)) score++;
      return { s, score };
    });
    scored.sort((a, b) => b.score - a.score ||
      (b.s.createdAt || '').localeCompare(a.s.createdAt || ''));
    return scored.slice(0, 3).map(x => x.s);
  },

  allSkills() {
    const set = new Set();
    Store.state.stories.forEach(s => (s.skills || []).forEach(k => set.add(k)));
    return [...set].sort();
  },

  filtered() {
    const q = this.ui.search.trim().toLowerCase();
    return Store.state.stories.filter(s => {
      if (this.ui.skill && !(s.skills || []).includes(this.ui.skill)) return false;
      if (!q) return true;
      return this.storyText(s).includes(q);
    }).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  },

  render() {
    const el = document.getElementById('tab-stories');
    const list = this.filtered();
    const n = Store.state.stories.length;

    el.innerHTML = `
      <div class="toolbar">
        <input type="search" id="st-search" placeholder="Search stories & skills…" value="${escapeHtml(this.ui.search)}" style="min-width:200px">
        <select id="st-skill">
          <option value="">All skills</option>
          ${this.allSkills().map(k => `<option value="${escapeHtml(k)}" ${this.ui.skill === k ? 'selected' : ''}>${escapeHtml(k)}</option>`).join('')}
        </select>
        <span class="muted small">${n} ${n === 1 ? 'story' : 'stories'} collected</span>
        <span class="spacer"></span>
        <button class="primary" id="st-add-btn">+ Add story</button>
      </div>
      ${this.addFormHtml()}
      ${n === 0 ? `<div class="card"><div class="empty-state">
          <b style="color:var(--ink)">Fifteen small stories beat one big portfolio.</b><br><br>
          Capture every concrete thing from your 10 months — the fix, the save, the thing you taught yourself.
          Each one becomes interview material, a resume bullet, and proof for the ATS matcher.<br><br>
          Stuck? Hit <b style="color:var(--ink)">+ Add story</b> and use the memory joggers.
        </div></div>`
        : (list.length ? `<div class="story-grid">${list.map(s => this.cardHtml(s)).join('')}</div>`
          : '<div class="card"><div class="empty-state">No stories match the current filters.</div></div>')}
      ${this.drawerHtml()}
    `;
    this.bind(el);
  },

  addFormHtml() {
    return `<div class="card section-gap ${this.ui.showAdd ? '' : 'hidden'}" id="st-add-panel">
      <h2>Add a story</h2>
      <p class="prompt-line">💭 ${escapeHtml(this.PROMPTS[this.ui.promptIdx % this.PROMPTS.length])}
        <button class="ghost tiny" id="st-next-prompt">Another prompt →</button></p>
      <div class="field"><label>Title (how you'd name it in conversation)</label><input id="sa-title" placeholder="e.g. Rescued the Q3 launch webinar"></div>
      <div class="grid grid-2">
        <div class="field"><label>Situation / context</label><textarea id="sa-situation" rows="2" placeholder="What was going on, what was at stake"></textarea></div>
        <div class="field"><label>What you did</label><textarea id="sa-action" rows="2" placeholder="Your specific actions — 'I', not 'we'"></textarea></div>
      </div>
      <div class="field"><label>Result / impact</label><textarea id="sa-result" rows="2" placeholder="What happened because of you — numbers if you have them, honest scale if you don't"></textarea></div>
      <div class="form-row">
        <div style="flex:1;min-width:200px"><label>Skills (comma-separated — these power the ATS & prep links)</label><input id="sa-skills" placeholder="e.g. sql, stakeholder management, event ops"></div>
        <div><label>Where from</label>
          <select id="sa-source">${Object.entries(this.SOURCES).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></div>
        <div><button class="primary" id="sa-save">Save story</button></div>
      </div>
    </div>`;
  },

  cardHtml(s) {
    return `<div class="story-card" data-id="${s.id}">
      <div class="who">${escapeHtml(s.title)}</div>
      ${s.result ? `<div class="small" style="color:var(--ink-2);margin-top:4px">${escapeHtml(s.result)}</div>` : ''}
      <div style="margin-top:8px">${(s.skills || []).map(k => `<span class="tag">${escapeHtml(k)}</span>`).join('')}
        <span class="muted small" style="float:right">${this.SOURCES[s.source] || ''}</span></div>
    </div>`;
  },

  drawerHtml() {
    const s = Store.state.stories.find(x => x.id === this.ui.selectedId);
    if (!s) return '';
    return `
      <div class="drawer-backdrop" id="st-drawer-bg"></div>
      <div class="drawer">
        <div class="drawer-head">
          <h2>${escapeHtml(s.title)}</h2>
          <div>
            <button class="danger tiny" id="sd-delete">Delete</button>
            <button class="ghost" id="st-drawer-close">✕</button>
          </div>
        </div>
        <div class="field"><label>Title</label><input data-sf="title" value="${escapeHtml(s.title)}"></div>
        <div class="field"><label>Situation / context</label><textarea data-sf="situation" rows="3">${escapeHtml(s.situation || '')}</textarea></div>
        <div class="field"><label>What you did</label><textarea data-sf="action" rows="3">${escapeHtml(s.action || '')}</textarea></div>
        <div class="field"><label>Result / impact</label><textarea data-sf="result" rows="3">${escapeHtml(s.result || '')}</textarea></div>
        <div class="field"><label>Skills (comma-separated)</label><input id="sd-skills" value="${escapeHtml((s.skills || []).join(', '))}"></div>
        <div class="field"><label>Where from</label>
          <select data-sf="source">${Object.entries(this.SOURCES).map(([v, l]) => `<option value="${v}" ${s.source === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <p class="muted small">Added ${fmtDate(s.createdAt)}</p>
      </div>`;
  },

  bind(el) {
    el.querySelector('#st-search').addEventListener('input', e => {
      this.ui.search = e.target.value;
      App.render();
      const i = document.getElementById('st-search');
      i.focus(); i.setSelectionRange(i.value.length, i.value.length);
    });
    el.querySelector('#st-skill').addEventListener('change', e => { this.ui.skill = e.target.value; App.render(); });
    el.querySelector('#st-add-btn').addEventListener('click', () => { this.ui.showAdd = !this.ui.showAdd; App.render(); });

    const nextPrompt = el.querySelector('#st-next-prompt');
    if (nextPrompt) nextPrompt.addEventListener('click', () => {
      this.ui.promptIdx++;
      el.querySelector('.prompt-line').childNodes[0].textContent = '💭 ' + this.PROMPTS[this.ui.promptIdx % this.PROMPTS.length] + ' ';
    });

    const save = el.querySelector('#sa-save');
    if (save) save.addEventListener('click', () => {
      const v = id => el.querySelector('#' + id).value.trim();
      if (!v('sa-title')) { alert('Give the story a title.'); return; }
      Store.state.stories.push({
        id: Store.uid(),
        title: v('sa-title'),
        situation: v('sa-situation'),
        action: v('sa-action'),
        result: v('sa-result'),
        skills: v('sa-skills').split(',').map(k => k.trim()).filter(Boolean),
        source: el.querySelector('#sa-source').value,
        createdAt: todayISO()
      });
      this.ui.showAdd = false;
      Store.save(); App.render();
      App.flash('Story saved — that’s one more piece of evidence.');
    });

    el.querySelectorAll('.story-card[data-id]').forEach(card => card.addEventListener('click', () => {
      this.ui.selectedId = card.dataset.id; App.render();
    }));

    // Drawer
    const bg = el.querySelector('#st-drawer-bg');
    if (!bg) return;
    const close = () => { this.ui.selectedId = null; App.render(); };
    bg.addEventListener('click', close);
    el.querySelector('#st-drawer-close').addEventListener('click', close);

    const s = Store.state.stories.find(x => x.id === this.ui.selectedId);
    el.querySelectorAll('[data-sf]').forEach(input => input.addEventListener('change', () => {
      s[input.dataset.sf] = input.value;
      Store.save();
    }));
    el.querySelector('#sd-skills').addEventListener('change', e => {
      s.skills = e.target.value.split(',').map(k => k.trim()).filter(Boolean);
      Store.save();
    });
    el.querySelector('#sd-delete').addEventListener('click', () => {
      if (!confirm('Delete this story?')) return;
      Store.state.stories = Store.state.stories.filter(x => x.id !== s.id);
      this.ui.selectedId = null;
      Store.save(); App.render();
    });
  }
};
