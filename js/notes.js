/* Notes — tasks + note cards side by side, plus header quick-capture from any tab. */

const Notes = {
  ui: { search: '', tag: '', showAddNote: false, selectedId: null, editTaskId: null },

  addTask(text, dueDate) {
    Store.state.tasks.push({
      id: Store.uid(), text, done: false,
      dueDate: dueDate || null, createdAt: todayISO(), doneAt: null
    });
  },

  addNote(title, body, tags) {
    Store.state.notes.push({
      id: Store.uid(), title, body: body || '', tags: tags || [],
      pinned: false, createdAt: todayISO(), updatedAt: todayISO()
    });
  },

  openTasks() {
    const t = todayISO();
    return Store.state.tasks.filter(x => !x.done).sort((a, b) => {
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });
  },

  allTags() {
    const set = new Set();
    Store.state.notes.forEach(n => (n.tags || []).forEach(t => set.add(t)));
    return [...set].sort();
  },

  filteredNotes() {
    const q = this.ui.search.trim().toLowerCase();
    return Store.state.notes.filter(n => {
      if (this.ui.tag && !(n.tags || []).includes(this.ui.tag)) return false;
      if (!q) return true;
      return (n.title + ' ' + n.body + ' ' + (n.tags || []).join(' ')).toLowerCase().includes(q);
    }).sort((a, b) =>
      (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) ||
      (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  },

  render() {
    const el = document.getElementById('tab-notes');
    const open = this.openTasks();
    const doneTasks = Store.state.tasks.filter(x => x.done)
      .sort((a, b) => (b.doneAt || '').localeCompare(a.doneAt || '')).slice(0, 10);
    const notes = this.filteredNotes();
    const t = todayISO();

    el.innerHTML = `
      <div class="grid grid-2" style="align-items:start">
        <div class="card">
          <h2>Tasks</h2>
          <div class="form-row" style="margin-bottom:10px">
            <div style="flex:1;min-width:160px"><input id="tk-text" placeholder="Add a task…"></div>
            <div><input type="date" id="tk-due" title="Due date (optional)"></div>
            <div><button class="primary" id="tk-add">Add</button></div>
          </div>
          ${open.length ? open.map(x => x.id === this.ui.editTaskId ? `
            <div class="task-row" data-id="${x.id}">
              <div class="form-row" style="flex:1;align-items:center">
                <div style="flex:1;min-width:140px"><input id="te-text" value="${escapeHtml(x.text)}"></div>
                <div><input type="date" id="te-due" value="${x.dueDate || ''}" title="Due date (clear to remove)"></div>
                <div><button class="primary tiny" id="te-save">Save</button></div>
                <div><button class="ghost tiny" id="te-cancel">Cancel</button></div>
              </div>
            </div>` : `
            <div class="task-row" data-id="${x.id}">
              <label class="prep-check"><input type="checkbox" data-task-toggle="${x.id}">
                <span>${escapeHtml(x.text)}
                  ${x.dueDate ? `<span class="${x.dueDate < t ? 'overdue' : x.dueDate === t ? 'due-today' : 'muted'} small"> · ${x.dueDate < t ? 'overdue ' : x.dueDate === t ? 'today' : 'due '}${x.dueDate === t ? '' : fmtDate(x.dueDate)}</span>` : ''}
                </span></label>
              <button class="ghost tiny" data-task-edit="${x.id}" title="Edit">✎</button>
              <button class="ghost tiny" data-task-del="${x.id}" title="Delete">✕</button>
            </div>`).join('')
          : '<p class="muted small">Nothing open. Add the next concrete action — even "draft one sentence" counts.</p>'}
          ${doneTasks.length ? `
            <h3 style="margin:14px 0 4px" class="muted">Completed</h3>
            ${doneTasks.map(x => `
              <div class="task-row done">
                <label class="prep-check"><input type="checkbox" checked data-task-toggle="${x.id}">
                  <span>${escapeHtml(x.text)}</span></label>
              </div>`).join('')}
            <button class="ghost tiny" id="tk-clear" style="margin-top:6px">Clear completed</button>` : ''}
        </div>

        <div>
          <div class="toolbar" style="margin-bottom:10px">
            <input type="search" id="nt-search" placeholder="Search notes…" value="${escapeHtml(this.ui.search)}" style="flex:1;min-width:120px">
            <select id="nt-tag">
              <option value="">All tags</option>
              ${this.allTags().map(tag => `<option value="${escapeHtml(tag)}" ${this.ui.tag === tag ? 'selected' : ''}>#${escapeHtml(tag)}</option>`).join('')}
            </select>
            <button class="primary" id="nt-add-btn">+ Add note</button>
          </div>
          <div class="card section-gap ${this.ui.showAddNote ? '' : 'hidden'}" id="nt-add-panel">
            <div class="field"><label>Title</label><input id="na-title" placeholder="e.g. Questions for midcareer chats"></div>
            <div class="field"><label>Note</label><textarea id="na-body" rows="4" placeholder="The thought, before it evaporates…"></textarea></div>
            <div class="form-row">
              <div style="flex:1;min-width:140px"><label>Tags (comma-separated)</label><input id="na-tags" placeholder="e.g. comp, questions"></div>
              <div><button class="primary" id="na-save">Save note</button></div>
            </div>
          </div>
          ${notes.length ? notes.map(n => `
            <div class="note-card" data-id="${n.id}">
              <div class="who">${n.pinned ? '📌 ' : ''}${escapeHtml(n.title || '(untitled)')}</div>
              ${n.body ? `<div class="note-body">${escapeHtml(n.body)}</div>` : ''}
              <div style="margin-top:8px">${(n.tags || []).map(tag => `<span class="tag">#${escapeHtml(tag)}</span>`).join('')}
                <span class="muted small" style="float:right">${fmtDate(n.updatedAt)}</span></div>
            </div>`).join('')
          : `<div class="card"><div class="empty-state">${Store.state.notes.length ? 'No notes match the current filters.' : 'A thought written down is a thought you can stop carrying.'}</div></div>`}
        </div>
      </div>
      ${this.drawerHtml()}
    `;
    this.bind(el);
  },

  drawerHtml() {
    const n = Store.state.notes.find(x => x.id === this.ui.selectedId);
    if (!n) return '';
    return `
      <div class="drawer-backdrop" id="nt-drawer-bg"></div>
      <div class="drawer">
        <div class="drawer-head">
          <h2>${n.pinned ? '📌 ' : ''}${escapeHtml(n.title || '(untitled)')}</h2>
          <div>
            <button class="tiny" id="nd-pin">${n.pinned ? 'Unpin' : 'Pin'}</button>
            <button class="danger tiny" id="nd-delete">Delete</button>
            <button class="ghost" id="nt-drawer-close">✕</button>
          </div>
        </div>
        <div class="field"><label>Title</label><input data-nf="title" value="${escapeHtml(n.title || '')}"></div>
        <div class="field"><label>Note</label><textarea data-nf="body" rows="10">${escapeHtml(n.body || '')}</textarea></div>
        <div class="field"><label>Tags (comma-separated)</label><input id="nd-tags" value="${escapeHtml((n.tags || []).join(', '))}"></div>
        <p class="muted small">Created ${fmtDate(n.createdAt)} · updated ${fmtDate(n.updatedAt)}</p>
      </div>`;
  },

  bind(el) {
    const addTask = () => {
      const text = el.querySelector('#tk-text').value.trim();
      if (!text) return;
      this.addTask(text, el.querySelector('#tk-due').value);
      Store.save(); App.render();
      document.getElementById('tk-text').focus();
    };
    el.querySelector('#tk-add').addEventListener('click', addTask);
    el.querySelector('#tk-text').addEventListener('keydown', e => { if (e.key === 'Enter') addTask(); });

    el.querySelectorAll('[data-task-toggle]').forEach(cb => cb.addEventListener('change', () => {
      const x = Store.state.tasks.find(t => t.id === cb.dataset.taskToggle);
      x.done = cb.checked;
      x.doneAt = cb.checked ? todayISO() : null;
      Store.save(); App.render();
    }));
    el.querySelectorAll('[data-task-del]').forEach(btn => btn.addEventListener('click', () => {
      Store.state.tasks = Store.state.tasks.filter(t => t.id !== btn.dataset.taskDel);
      Store.save(); App.render();
    }));
    el.querySelectorAll('[data-task-edit]').forEach(btn => btn.addEventListener('click', () => {
      this.ui.editTaskId = btn.dataset.taskEdit;
      App.render();
      const inp = document.getElementById('te-text');
      if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
    }));
    const teSave = el.querySelector('#te-save');
    if (teSave) {
      const saveEdit = () => {
        const x = Store.state.tasks.find(t2 => t2.id === this.ui.editTaskId);
        const text = el.querySelector('#te-text').value.trim();
        if (!text) { alert('Task text can’t be empty — use ✕ to delete it instead.'); return; }
        x.text = text;
        x.dueDate = el.querySelector('#te-due').value || null;
        this.ui.editTaskId = null;
        Store.save(); App.render();
      };
      teSave.addEventListener('click', saveEdit);
      el.querySelector('#te-text').addEventListener('keydown', e => {
        if (e.key === 'Enter') saveEdit();
        if (e.key === 'Escape') { this.ui.editTaskId = null; App.render(); }
      });
      el.querySelector('#te-cancel').addEventListener('click', () => { this.ui.editTaskId = null; App.render(); });
    }
    const clear = el.querySelector('#tk-clear');
    if (clear) clear.addEventListener('click', () => {
      Store.state.tasks = Store.state.tasks.filter(t => !t.done);
      Store.save(); App.render();
    });

    // Notes
    el.querySelector('#nt-search').addEventListener('input', e => {
      this.ui.search = e.target.value;
      App.render();
      const s = document.getElementById('nt-search');
      s.focus(); s.setSelectionRange(s.value.length, s.value.length);
    });
    el.querySelector('#nt-tag').addEventListener('change', e => { this.ui.tag = e.target.value; App.render(); });
    el.querySelector('#nt-add-btn').addEventListener('click', () => { this.ui.showAddNote = !this.ui.showAddNote; App.render(); });

    const saveNote = el.querySelector('#na-save');
    if (saveNote) saveNote.addEventListener('click', () => {
      const title = el.querySelector('#na-title').value.trim();
      const body = el.querySelector('#na-body').value.trim();
      if (!title && !body) { alert('Write something first.'); return; }
      this.addNote(title || body.split('\n')[0].slice(0, 60), body,
        el.querySelector('#na-tags').value.split(',').map(t => t.trim()).filter(Boolean));
      this.ui.showAddNote = false;
      Store.save(); App.render();
    });

    el.querySelectorAll('.note-card[data-id]').forEach(card => card.addEventListener('click', () => {
      this.ui.selectedId = card.dataset.id; App.render();
    }));

    // Drawer
    const bg = el.querySelector('#nt-drawer-bg');
    if (!bg) return;
    const close = () => { this.ui.selectedId = null; App.render(); };
    bg.addEventListener('click', close);
    el.querySelector('#nt-drawer-close').addEventListener('click', close);

    const n = Store.state.notes.find(x => x.id === this.ui.selectedId);
    el.querySelectorAll('[data-nf]').forEach(input => input.addEventListener('change', () => {
      n[input.dataset.nf] = input.value;
      n.updatedAt = todayISO();
      Store.save();
    }));
    el.querySelector('#nd-tags').addEventListener('change', e => {
      n.tags = e.target.value.split(',').map(t => t.trim()).filter(Boolean);
      n.updatedAt = todayISO();
      Store.save();
    });
    el.querySelector('#nd-pin').addEventListener('click', () => {
      n.pinned = !n.pinned;
      Store.save(); App.render();
    });
    el.querySelector('#nd-delete').addEventListener('click', () => {
      if (!confirm('Delete this note?')) return;
      Store.state.notes = Store.state.notes.filter(x => x.id !== n.id);
      this.ui.selectedId = null;
      Store.save(); App.render();
    });
  },

  /* ---------- header quick-capture (works on any tab) ---------- */

  quickCapture() {
    if (document.getElementById('quick-capture')) { this.closeQuickCapture(); return; }
    const div = document.createElement('div');
    div.id = 'quick-capture';
    div.innerHTML = `
      <div class="qc-head"><b>Quick capture</b><button class="ghost tiny" id="qc-close">✕</button></div>
      <textarea id="qc-text" rows="4" placeholder="First line becomes the title if you save as a note."></textarea>
      <div class="form-row" style="margin-top:8px">
        <button class="primary tiny" id="qc-note">Save as note</button>
        <button class="tiny" id="qc-task">Save as task</button>
      </div>`;
    document.body.appendChild(div);
    const ta = document.getElementById('qc-text');
    ta.focus();
    ta.addEventListener('keydown', e => { if (e.key === 'Escape') this.closeQuickCapture(); });
    document.getElementById('qc-close').addEventListener('click', () => this.closeQuickCapture());
    document.getElementById('qc-note').addEventListener('click', () => {
      const text = ta.value.trim();
      if (!text) return;
      const lines = text.split('\n');
      this.addNote(lines[0].slice(0, 80), lines.slice(1).join('\n').trim(), []);
      Store.save(); this.closeQuickCapture();
      App.render(); App.flash('Note saved — it’s in the Notes tab.');
    });
    document.getElementById('qc-task').addEventListener('click', () => {
      const text = ta.value.trim();
      if (!text) return;
      this.addTask(text.replace(/\n+/g, ' '), null);
      Store.save(); this.closeQuickCapture();
      App.render(); App.flash('Task added — it’s in the Notes tab.');
    });
  },

  closeQuickCapture() {
    const div = document.getElementById('quick-capture');
    if (div) div.remove();
  }
};
