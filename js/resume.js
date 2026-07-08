/* Resume / ATS — extract keywords from a job description and match them
   against resume text: score, matched list, missing list. */

const Resume = {
  ui: { result: null },

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

  render() {
    const el = document.getElementById('tab-resume');
    const s = Store.state.settings;
    const r = this.ui.result;

    el.innerHTML = `
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
