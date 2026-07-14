/* Store — state schema, localStorage persistence, JSON export/import, shared helpers. */

const Store = {
  KEY: 'career-dashboard-v1',
  state: null,

  defaults() {
    const start = todayISO();
    return {
      settings: {
        startDate: start,
        endDate: addDaysISO(start, 90),
        weeklyGoals: { applications: 2, outreach: 8, informationals: 3 },
        phases: [],
        buckets: ['Think tank', 'Consultancy', 'Legislative'],
        skillCategories: ['Tools', 'Languages', 'Certifications', 'Domain'],
        theme: 'dark', // 'dark' | 'light' | 'system'
        resumeText: '',
        jdText: '',
        lastBackup: null
      },
      contacts: [],
      applications: [],
      activities: [],
      meetings: [],
      stories: [],
      skills: [],
      tasks: [],
      notes: [],
      hillTargets: [],
      materials: [],
      references: []
    };
  },

  load() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(this.KEY)); } catch (e) { /* corrupted — start fresh */ }
    const d = this.defaults();
    this.state = saved && typeof saved === 'object' ? saved : d;
    this.state.settings = Object.assign(d.settings, this.state.settings || {});
    this.state.settings.weeklyGoals = Object.assign(d.settings.weeklyGoals, this.state.settings.weeklyGoals || {});
    if (!Array.isArray(this.state.settings.phases)) this.state.settings.phases = [];
    if (!Array.isArray(this.state.settings.buckets)) this.state.settings.buckets = d.settings.buckets;
    if (!Array.isArray(this.state.settings.skillCategories)) this.state.settings.skillCategories = d.settings.skillCategories;
    this.state.contacts = this.state.contacts || [];
    this.state.applications = this.state.applications || [];
    this.state.activities = this.state.activities || [];
    this.state.meetings = this.state.meetings || [];
    this.state.stories = this.state.stories || [];
    this.state.skills = this.state.skills || [];
    this.state.tasks = this.state.tasks || [];
    this.state.notes = this.state.notes || [];
    this.state.hillTargets = this.state.hillTargets || [];
    this.state.materials = this.state.materials || [];
    this.state.references = this.state.references || [];
    return this.state;
  },

  save() {
    localStorage.setItem(this.KEY, JSON.stringify(this.state));
  },

  uid() {
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  },

  exportJSON() {
    const blob = new Blob([JSON.stringify(this.state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'job-search-backup-' + todayISO() + '.json';
    a.click();
    URL.revokeObjectURL(a.href);
    this.state.settings.lastBackup = todayISO();
    this.save();
  },

  importJSON(file, done) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data || !Array.isArray(data.contacts) || !Array.isArray(data.applications)) {
          throw new Error('Not a Job Search HQ backup file.');
        }
        // Re-merge defaults so older backups gain any new fields.
        localStorage.setItem(this.KEY, JSON.stringify(data));
        this.load();
        this.save();
        done(null);
      } catch (e) {
        done(e.message || 'Could not read that file.');
      }
    };
    reader.onerror = () => done('Could not read that file.');
    reader.readAsText(file);
  }
};

/* ---------- shared date & text helpers ---------- */

function todayISO() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function addDaysISO(iso, days) {
  const d = parseISO(iso);
  d.setDate(d.getDate() + days);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/* Parse YYYY-MM-DD as a local date (new Date('YYYY-MM-DD') is UTC and shifts a day). */
function parseISO(iso) {
  const p = String(iso).split('-').map(Number);
  return new Date(p[0], (p[1] || 1) - 1, p[2] || 1);
}

function daysBetween(fromISO, toISO) {
  return Math.round((parseISO(toISO) - parseISO(fromISO)) / 86400000);
}

/* Monday of the week containing the given date. */
function weekStartISO(iso) {
  const d = parseISO(iso);
  const day = (d.getDay() + 6) % 7; // Mon=0
  d.setDate(d.getDate() - day);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function fmtDate(iso) {
  if (!iso) return '';
  return parseISO(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* '14:00' → '2:00 PM' */
function fmtTime(hhmm) {
  if (!hhmm) return '';
  const p = hhmm.split(':').map(Number);
  const am = p[0] < 12;
  const h = p[0] % 12 || 12;
  return h + ':' + String(p[1] || 0).padStart(2, '0') + ' ' + (am ? 'AM' : 'PM');
}

function contactName(c) {
  return ((c.firstName || '') + ' ' + (c.lastName || '')).trim() || '(no name)';
}

/* The search-plan phase containing today, or null when no phases are defined
   (the UI then falls back to the plain start/end countdown). */
function currentPhase() {
  const phases = (Store.state.settings.phases || []).filter(p => p.start && p.end);
  if (!phases.length) return null;
  const t = todayISO();
  const idx = phases.findIndex(p => t >= p.start && t <= p.end);
  if (idx === -1) return null;
  return { phase: phases[idx], idx, total: phases.length };
}
