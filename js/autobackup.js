/* AutoBackup — writes a JSON backup into a user-chosen local folder (File
   System Access API) whenever data changes, so manual exports stop being a
   chore. The folder handle lives in IndexedDB (localStorage can't hold one);
   nothing ever leaves the machine. Chrome/Edge only — Settings explains
   elsewhere. Point it at the repo's data/ folder: it's gitignored, and both
   filenames match the ignored job-search-backup-*.json pattern. */

const AutoBackup = {
  DB: 'career-autobackup',
  STORE: 'kv',
  HANDLE_KEY: 'dirHandle',
  handle: null,
  permission: 'off', // 'off' | 'granted' | 'prompt'
  lastWrite: null,   // HH:MM of the last successful write this session
  _timer: null,

  supported() {
    return typeof window.showDirectoryPicker === 'function';
  },

  async init() {
    if (!this.supported()) return;
    try {
      this.handle = await this._idbGet(this.HANDLE_KEY);
      if (!this.handle) return;
      this.permission = await this.handle.queryPermission({ mode: 'readwrite' });
      if (this.permission === 'granted') await this.writeNow();
    } catch (e) {
      this.handle = null;
      this.permission = 'off';
    }
  },

  async pickFolder() {
    const dir = await window.showDirectoryPicker({ mode: 'readwrite' });
    this.handle = dir;
    this.permission = 'granted';
    await this._idbSet(this.HANDLE_KEY, dir);
    await this.writeNow();
  },

  /* Re-grant after the browser drops permission; must run from a click. */
  async resume() {
    if (!this.handle) return;
    this.permission = await this.handle.requestPermission({ mode: 'readwrite' });
    if (this.permission === 'granted') await this.writeNow();
  },

  async disable() {
    clearTimeout(this._timer);
    this.handle = null;
    this.permission = 'off';
    this.lastWrite = null;
    await this._idbSet(this.HANDLE_KEY, null);
  },

  /* Called from Store.save() — debounced so rapid edits coalesce. */
  schedule() {
    if (this.permission !== 'granted') return;
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this.writeNow(), 1200);
  },

  async writeNow() {
    if (!this.handle || this.permission !== 'granted') return;
    try {
      const json = JSON.stringify(Store.state, null, 2);
      await this._writeFile('job-search-backup-autosave.json', json);
      const today = todayISO();
      if (Store.state.settings.autoBackupLastDaily !== today) {
        await this._writeFile('job-search-backup-' + today + '.json', json);
        Store.state.settings.autoBackupLastDaily = today;
      }
      /* Freshen the backup stamp directly — going through Store.save()
         would re-schedule us forever. */
      Store.state.settings.lastBackup = today;
      localStorage.setItem(Store.KEY, JSON.stringify(Store.state));
      this.lastWrite = new Date().toTimeString().slice(0, 5);
      const el = document.getElementById('ab-status');
      if (el) el.textContent = this.statusText();
    } catch (e) {
      if (e && e.name === 'NotAllowedError') {
        this.permission = 'prompt';
        if (typeof App !== 'undefined') App.renderBackupBanner();
      }
    }
  },

  async _writeFile(name, contents) {
    const fh = await this.handle.getFileHandle(name, { create: true });
    const w = await fh.createWritable();
    await w.write(contents);
    await w.close();
  },

  statusText() {
    if (this.permission === 'granted') {
      return 'Auto-backup is on — saving to “' + (this.handle && this.handle.name || 'folder') + '”' +
        (this.lastWrite ? ' · last saved ' + this.lastWrite : '');
    }
    if (this.permission === 'prompt') {
      return 'Auto-backup is paused — the browser needs you to re-allow folder access.';
    }
    return '';
  },

  _db() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(this.STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async _idbGet(key) {
    const db = await this._db();
    return new Promise((resolve, reject) => {
      const rq = db.transaction(this.STORE, 'readonly').objectStore(this.STORE).get(key);
      rq.onsuccess = () => resolve(rq.result || null);
      rq.onerror = () => reject(rq.error);
    });
  },

  async _idbSet(key, val) {
    const db = await this._db();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE, 'readwrite');
      tx.objectStore(this.STORE).put(val, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
};
