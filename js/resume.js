/* Resume / ATS — extract keywords from a job description and match them
   against resume text: score, matched list, missing list. */

const Resume = {
  ui: { result: null, matSelected: null, showAddMat: false, showAddRef: false },

  /* Hill offices don't run ATS — the packet that matters is a 1-page Hill-format
     resume, a cover letter per hook, and polished writing samples. */
  KINDS: { 'hill-resume': 'Hill resume', 'cover-letter': 'Cover letters', 'writing-sample': 'Writing samples' },
  KIND_LABEL: { 'hill-resume': 'Hill resume', 'cover-letter': 'Cover letter', 'writing-sample': 'Writing sample' },
  HOOK_LABELS: { '': '—', nc: 'North Carolina', 'harvard-ma': 'Harvard / MA', 'india-caucus': 'India Caucus', 'think-tank': 'Think tank' },
  REF_FLOW: { 'to-ask': 'asked', asked: 'confirmed' },
  REF_LABELS: { 'to-ask': 'to ask', asked: 'asked', confirmed: 'confirmed ✓' },

  STOPWORDS: new Set(('a,an,and,are,as,at,be,been,being,but,by,can,could,did,do,does,doing,for,from,had,has,have,having,' +
    'he,her,hers,him,his,how,i,if,in,into,is,it,its,itself,just,me,more,most,my,no,nor,not,now,of,off,on,once,only,or,' +
    'other,our,ours,out,over,own,same,she,should,so,some,such,than,that,the,their,theirs,them,then,there,these,they,' +
    'this,those,through,to,too,under,until,up,very,was,we,were,what,when,where,which,while,who,whom,why,will,with,you,' +
    'your,yours,about,above,after,again,against,all,am,any,because,before,below,between,both,down,during,each,few,further,' +
    // job-posting boilerplate that isn't a skill
    'ability,able,across,also,applicant,applicants,apply,benefits,candidate,candidates,company,day,days,degree,description,' +
    'employee,employees,employer,equal,etc,excellent,experience,experienced,help,ideal,include,includes,including,job,join,' +
    'like,looking,love,make,may,member,must,new,offer,opportunity,opportunities,organization,people,per,plus,position,' +
    'preferred,proven,related,required,requirements,responsibilities,responsible,role,salary,seeking,skills,someone,strong,' +
    'team,teams,time,us,using,well,willing,within,work,working,world,year,years,youll,abilities,' +
    // contraction fragments left behind by tokenizing (we're → we + re)
    're,ll,ve,don,doesn,isn,aren,won,didn').split(',')),

  /* Common hard-skill / ATS terms; presence in this list boosts a keyword's weight. */
  SKILL_TERMS: new Set(['python', 'sql', 'java', 'javascript', 'typescript', 'react', 'node', 'aws', 'azure', 'gcp', 'excel',
    'tableau', 'power bi', 'r', 'sas', 'spark', 'hadoop', 'etl', 'api', 'rest', 'docker', 'kubernetes', 'git', 'linux',
    'agile', 'scrum', 'kanban', 'jira', 'confluence', 'salesforce', 'hubspot', 'crm', 'seo', 'sem', 'a/b testing',
    'machine learning', 'deep learning', 'nlp', 'data analysis', 'data science', 'data engineering', 'statistics',
    'project management', 'product management', 'program management', 'stakeholder management', 'change management',
    'risk management', 'vendor management', 'account management', 'people management', 'cross functional',
    'business development', 'strategic planning', 'financial modeling', 'forecasting', 'budgeting', 'procurement',
    'supply chain', 'operations', 'compliance', 'audit', 'gaap', 'cpa', 'pmp', 'six sigma', 'lean', 'kpi', 'kpis',
    'roadmap', 'go to market', 'user research', 'ux', 'ui', 'figma', 'analytics', 'communication', 'leadership',
    'negotiation', 'presentation', 'copywriting', 'content marketing', 'email marketing', 'social media',
    'customer success', 'customer service', 'onboarding', 'recruiting', 'sourcing', 'training', 'mentoring']),

  /* Light suffix-stripping so "managed/managing" matches "manage". */
  stem(w) {
    if (w.length > 5 && w.endsWith('ing')) return w.slice(0, -3);
    if (w.length > 4 && w.endsWith('ed')) return w.slice(0, -2);
    if (w.length > 4 && w.endsWith('es')) return w.slice(0, -2);
    if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
    return w;
  },

  /* Tokenize into word runs, keeping tech chars (c++, c#, node.js, a/b).
     Hyphens split words so "cross-functional" and "cross functional" match. */
  tokenize(text) {
    return (text.toLowerCase().match(/[a-z0-9][a-z0-9+#./&]*/g) || [])
      .map(t => t.replace(/[./]+$/, ''));
  },

  /* Split into clause chunks so n-grams don't span punctuation. */
  clauses(text) {
    return text.toLowerCase().split(/[.,;:!?()\[\]•·|\n\r\t"]+/);
  },

  extract(jd) {
    const counts = new Map();
    const bump = (term, n) => counts.set(term, (counts.get(term) || 0) + n);

    // Unigrams
    for (const t of this.tokenize(jd)) {
      if (t.length < 2 || this.STOPWORDS.has(t) || /^\d[\d+.]*$/.test(t)) continue;
      bump(t, 1);
    }

    // Bigrams / trigrams within clauses, all words non-stopword
    const ngramCounts = new Map();
    for (const clause of this.clauses(jd)) {
      const words = this.tokenize(clause).filter(t => t.length > 1 && !/^\d[\d+.]*$/.test(t));
      for (let n = 2; n <= 3; n++) {
        for (let i = 0; i + n <= words.length; i++) {
          const gram = words.slice(i, i + n);
          if (gram.some(w => this.STOPWORDS.has(w))) continue;
          const key = gram.join(' ');
          ngramCounts.set(key, (ngramCounts.get(key) || 0) + 1);
        }
      }
    }
    // Keep n-grams that repeat or are known skill terms.
    for (const [gram, n] of ngramCounts) {
      if (n >= 2 || this.SKILL_TERMS.has(gram)) counts.set(gram, Math.max(n, counts.get(gram) || 0));
    }

    // Score: frequency × (2 if a known skill term). Fold unigrams that only
    // ever appear inside a kept n-gram would over-count; instead just discount
    // unigrams that are part of a kept n-gram with equal frequency.
    const kept = [];
    for (const [term, freq] of counts) {
      let weight = freq * (this.SKILL_TERMS.has(term) ? 2 : 1);
      if (!term.includes(' ')) {
        for (const [gram, gFreq] of counts) {
          if (gram.includes(' ') && gram.split(' ').includes(term) && gFreq >= freq) { weight = 0; break; }
        }
      }
      if (weight > 0) kept.push({ term, freq, weight });
    }
    kept.sort((a, b) => b.weight - a.weight || b.term.length - a.term.length);
    return kept.slice(0, 30);
  },

  /* Does the resume contain this term? Stemmed token match for unigrams,
     stemmed sequence match for n-grams. */
  buildResumeIndex(resume) {
    const tokens = this.tokenize(resume).map(t => this.stem(t));
    return { tokens, set: new Set(tokens), joined: ' ' + tokens.join(' ') + ' ' };
  },

  matches(term, index) {
    if (!term.includes(' ')) return index.set.has(this.stem(term));
    const seq = term.split(' ').map(w => this.stem(w)).join(' ');
    return index.joined.includes(' ' + seq + ' ');
  },

  analyze() {
    const jd = Store.state.settings.jdText || '';
    const resume = Store.state.settings.resumeText || '';
    if (!jd.trim() || !resume.trim()) {
      this.ui.result = { error: 'Paste both a job description and your resume text, then analyze.' };
      return;
    }
    const keywords = this.extract(jd);
    const index = this.buildResumeIndex(resume);
    const matched = [], missing = [];
    let got = 0, total = 0;
    for (const k of keywords) {
      total += k.weight;
      if (this.matches(k.term, index)) { matched.push(k); got += k.weight; }
      else missing.push(k);
    }
    this.ui.result = {
      score: total ? Math.round((got / total) * 100) : 0,
      matched, missing
    };
  },

  materialsHtml() {
    const mats = Store.state.materials;
    const groups = Object.keys(this.KINDS).map(kind => {
      const items = mats.filter(m => m.kind === kind);
      if (!items.length) return '';
      return `<div class="mat-kind-head">${this.KINDS[kind]}</div>` + items.map(m => {
        const open = this.ui.matSelected === m.id;
        return `<div class="mat-item ${open ? 'open' : ''}" data-mat="${m.id}">
          <div class="mat-head">
            <span class="who">${escapeHtml(m.title || '(untitled)')}</span>
            ${m.hook ? `<span class="hook-tag tag">${this.HOOK_LABELS[m.hook] || m.hook}</span>` : ''}
            <span class="status-badge ${m.status === 'ready' ? 'st-ready' : ''}">${m.status}</span>
            <span class="spacer"></span>
            <span class="muted small">updated ${fmtDate(m.updatedAt)}</span>
          </div>
          ${open ? `<div class="mat-editor" data-stop>
            <div class="form-row">
              <div style="flex:1;min-width:180px"><label>Title</label><input data-mf="title" value="${escapeHtml(m.title || '')}"></div>
              <div><label>Hook</label><select data-mf="hook">
                ${Object.keys(this.HOOK_LABELS).map(h => `<option value="${h}" ${(m.hook || '') === h ? 'selected' : ''}>${this.HOOK_LABELS[h]}</option>`).join('')}
              </select></div>
              <div><label>Status</label><select data-mf="status">
                <option value="draft" ${m.status !== 'ready' ? 'selected' : ''}>draft</option>
                <option value="ready" ${m.status === 'ready' ? 'selected' : ''}>ready</option>
              </select></div>
            </div>
            <div class="field"><label>Content</label><textarea data-mf="body" rows="14">${escapeHtml(m.body || '')}</textarea></div>
            <div class="form-row">
              <button class="tiny" data-mat-copy="${m.id}">Copy text</button>
              <button class="danger tiny" data-mat-del="${m.id}">Delete</button>
            </div>
          </div>` : ''}
        </div>`;
      }).join('');
    }).join('');
    return `<div class="card section-gap">
      <h2>Hill materials</h2>
      <p class="muted small">The packet Hill offices actually ask for: a 1-page Hill-format resume, a cover letter per hook, and 2–3 polished writing samples. Flip a piece to <b>ready</b> once it's send-worthy.</p>
      <div class="toolbar" style="margin:0 0 4px"><span class="spacer"></span><button class="tiny" id="mat-add-btn">+ Add material</button></div>
      <div id="mat-add-form" class="${this.ui.showAddMat ? '' : 'hidden'}">
        <div class="form-row">
          <div><label>Type</label><select id="ma-kind">
            ${Object.keys(this.KIND_LABEL).map(k => `<option value="${k}">${this.KIND_LABEL[k]}</option>`).join('')}
          </select></div>
          <div style="flex:1;min-width:180px"><label>Title *</label><input id="ma-title" placeholder="e.g. Cover letter — NC delegation"></div>
          <div><label>Hook</label><select id="ma-hook">
            ${Object.keys(this.HOOK_LABELS).map(h => `<option value="${h}">${this.HOOK_LABELS[h]}</option>`).join('')}
          </select></div>
          <div><button class="primary" id="ma-save">Save</button></div>
        </div>
      </div>
      ${groups || '<div class="empty-state">No materials yet. Add your Hill resume, cover letter templates, and writing samples.</div>'}
    </div>`;
  },

  referencesHtml() {
    const refs = Store.state.references;
    return `<div class="card section-gap">
      <h2>References</h2>
      <p class="muted small">Hill offices ask for references immediately and call them fast — confirm and warm yours before the first application goes out.</p>
      ${refs.length ? `<ul class="item-list">
        ${refs.map(r => `<li>
          <span class="grow"><span class="who">${escapeHtml(r.name)}</span>
            <span class="muted small">${escapeHtml(r.role || '')}</span>
            ${r.notes ? `<br><span class="muted small">${escapeHtml(r.notes)}</span>` : ''}</span>
          <span class="status-badge ${r.status === 'confirmed' ? 'st-meeting-set' : (r.status === 'asked' ? 'st-sent-to-liaison' : '')}">${this.REF_LABELS[r.status] || r.status}</span>
          ${this.REF_FLOW[r.status] ? `<button class="tiny" data-ref-next="${r.id}">Mark ${this.REF_FLOW[r.status]}</button>` : ''}
          <button class="ghost tiny" data-ref-del="${r.id}" title="Remove">✕</button>
        </li>`).join('')}
      </ul>` : '<div class="empty-state">No references tracked yet.</div>'}
      <div class="toolbar" style="margin:8px 0 0">
        <span class="spacer"></span><button class="tiny" id="ref-add-btn">+ Add reference</button>
      </div>
      <div id="ref-add-form" class="${this.ui.showAddRef ? '' : 'hidden'}">
        <div class="form-row">
          <div><label>Name *</label><input id="rf-name"></div>
          <div style="flex:1;min-width:160px"><label>Role / relationship</label><input id="rf-role" placeholder="e.g. Hudson Institute — direct supervisor"></div>
          <div><button class="primary" id="rf-save">Save</button></div>
        </div>
      </div>
    </div>`;
  },

  render() {
    const el = document.getElementById('tab-resume');
    const s = Store.state.settings;
    const r = this.ui.result;

    el.innerHTML = `
      ${this.materialsHtml()}
      ${this.referencesHtml()}
      <h2 style="margin:18px 0 10px">Keyword matcher <span class="muted small" style="font-weight:400">— for think-tank and corporate postings that do run ATS</span></h2>
      <div class="grid grid-2 section-gap">
        <div class="card">
          <h2>Job description</h2>
          <textarea id="rs-jd" rows="14" placeholder="Paste the job posting here…">${escapeHtml(s.jdText || '')}</textarea>
        </div>
        <div class="card">
          <h2>Your resume text</h2>
          <textarea id="rs-resume" rows="14" placeholder="Paste your resume's plain text here — it's saved locally so you only do this once.">${escapeHtml(s.resumeText || '')}</textarea>
        </div>
      </div>
      <div class="toolbar">
        <button class="primary" id="rs-analyze">Analyze match</button>
        <span class="muted small">Both boxes are saved automatically on this device.</span>
      </div>
      <div id="rs-result">${this.resultHtml()}</div>
    `;

    el.querySelector('#rs-jd').addEventListener('change', e => { s.jdText = e.target.value; Store.save(); });
    el.querySelector('#rs-resume').addEventListener('change', e => { s.resumeText = e.target.value; Store.save(); });
    el.querySelector('#rs-analyze').addEventListener('click', () => {
      s.jdText = el.querySelector('#rs-jd').value;
      s.resumeText = el.querySelector('#rs-resume').value;
      Store.save();
      this.analyze();
      document.getElementById('rs-result').innerHTML = this.resultHtml();
      this.bindResult();
    });
    this.bindResult();
    this.bindMaterials(el);
    this.bindReferences(el);
  },

  bindMaterials(el) {
    el.querySelector('#mat-add-btn').addEventListener('click', () => { this.ui.showAddMat = !this.ui.showAddMat; App.render(); });
    const save = el.querySelector('#ma-save');
    if (save) save.addEventListener('click', () => {
      const title = el.querySelector('#ma-title').value.trim();
      if (!title) { alert('Give the material a title.'); return; }
      const m = { id: Store.uid(), kind: el.querySelector('#ma-kind').value, title,
        hook: el.querySelector('#ma-hook').value, status: 'draft', body: '',
        createdAt: todayISO(), updatedAt: todayISO() };
      Store.state.materials.push(m);
      this.ui.showAddMat = false; this.ui.matSelected = m.id;
      Store.save(); App.render();
    });
    el.querySelectorAll('.mat-item').forEach(item => item.addEventListener('click', e => {
      if (e.target.closest('.mat-editor')) return; // clicks inside the editor don't toggle
      this.ui.matSelected = this.ui.matSelected === item.dataset.mat ? null : item.dataset.mat;
      App.render();
    }));
    const m = Store.state.materials.find(x => x.id === this.ui.matSelected);
    el.querySelectorAll('[data-mf]').forEach(input => input.addEventListener('change', () => {
      m[input.dataset.mf] = input.value;
      m.updatedAt = todayISO();
      Store.save(); App.render();
    }));
    el.querySelectorAll('[data-mat-copy]').forEach(b => b.addEventListener('click', () => {
      const mat = Store.state.materials.find(x => x.id === b.dataset.matCopy);
      Hill.copyText(mat.body || '', 'Copied "' + mat.title + '".');
    }));
    el.querySelectorAll('[data-mat-del]').forEach(b => b.addEventListener('click', () => {
      if (!confirm('Delete this material?')) return;
      Store.state.materials = Store.state.materials.filter(x => x.id !== b.dataset.matDel);
      this.ui.matSelected = null;
      Store.save(); App.render();
    }));
  },

  bindReferences(el) {
    el.querySelector('#ref-add-btn').addEventListener('click', () => { this.ui.showAddRef = !this.ui.showAddRef; App.render(); });
    const save = el.querySelector('#rf-save');
    if (save) save.addEventListener('click', () => {
      const name = el.querySelector('#rf-name').value.trim();
      if (!name) { alert('Name is required.'); return; }
      Store.state.references.push({ id: Store.uid(), name, role: el.querySelector('#rf-role').value.trim(),
        status: 'to-ask', notes: '', contactId: '', createdAt: todayISO() });
      this.ui.showAddRef = false;
      Store.save(); App.render();
    });
    el.querySelectorAll('[data-ref-next]').forEach(b => b.addEventListener('click', () => {
      const ref = Store.state.references.find(x => x.id === b.dataset.refNext);
      ref.status = this.REF_FLOW[ref.status] || ref.status;
      Store.save(); App.render();
    }));
    el.querySelectorAll('[data-ref-del]').forEach(b => b.addEventListener('click', () => {
      if (!confirm('Remove this reference?')) return;
      Store.state.references = Store.state.references.filter(x => x.id !== b.dataset.refDel);
      Store.save(); App.render();
    }));
  },

  resultHtml() {
    const r = this.ui.result;
    if (!r) return `<div class="card"><div class="empty-state">
      Paste a job description and your resume, then hit <b>Analyze match</b>.<br>
      You'll get an ATS-style match score, the keywords you already cover, and the ones to work in.</div></div>`;
    if (r.error) return `<div class="card"><span class="due-today">${escapeHtml(r.error)}</span></div>`;
    const chip = (k, cls) => {
      let storyMark = '';
      if (cls === 'missing' && typeof Stories !== 'undefined') {
        const hits = Stories.matchingKeyword(k.term);
        if (hits.length) storyMark = `<span class="story-mark" title="${escapeHtml(hits.map(s => s.title).join(' · '))}">✓ story</span>`;
      }
      return `<span class="chip ${cls}">${escapeHtml(k.term)}<span class="freq">×${k.freq}</span>${storyMark}</span>`;
    };
    return `<div class="card">
      <div class="score-line">
        <span class="big">${r.score}%</span>
        <span class="muted">keyword match, weighted by how much the posting emphasizes each term</span>
      </div>
      <div class="meter ${r.score >= 70 ? 'met' : ''}" style="max-width:420px"><span style="width:${r.score}%"></span></div>
      <h3 style="margin:18px 0 0">Missing from your resume (${r.missing.length})</h3>
      <p class="muted small" style="margin:2px 0 0">Ranked by importance in the posting. Work the honest ones into your bullets.</p>
      <div class="chips">${r.missing.length ? r.missing.map(k => chip(k, 'missing')).join('') : '<span class="muted small">Nothing missing — great coverage.</span>'}</div>
      ${r.missing.length && Store.state.stories.length ? `<p class="muted small" style="margin:8px 0 0"><span class="story-mark">✓ story</span> = your story bank already has evidence for this — turn it into a resume bullet (hover to see which story). No ✓ may mean a real gap worth a portfolio sprint.</p>` : ''}
      ${r.missing.length ? `<div style="margin-top:10px"><button class="tiny" id="rs-copy">Copy missing keywords</button> <span class="muted small" id="rs-copied"></span></div>` : ''}
      <h3 style="margin:18px 0 0">Already covered (${r.matched.length})</h3>
      <div class="chips">${r.matched.map(k => chip(k, 'matched')).join('') || '<span class="muted small">None yet.</span>'}</div>
    </div>`;
  },

  bindResult() {
    const btn = document.getElementById('rs-copy');
    if (!btn) return;
    btn.addEventListener('click', () => {
      navigator.clipboard.writeText(this.ui.result.missing.map(k => k.term).join(', ')).then(() => {
        document.getElementById('rs-copied').textContent = 'Copied.';
      });
    });
  }
};
