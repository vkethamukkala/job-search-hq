/* CSV — RFC-4180-ish parser plus LinkedIn Connections.csv mapping. */

const CSV = {

  /* Parse CSV text into an array of row arrays. Handles quoted fields,
     embedded commas/newlines, escaped quotes ("") and CRLF line endings. */
  parse(text) {
    const rows = [];
    let row = [], field = '', inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else inQuotes = false;
        } else field += ch;
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(field); field = '';
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(field); field = '';
        rows.push(row); row = [];
      } else {
        field += ch;
      }
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows;
  },

  /* LinkedIn's Connections.csv prepends a "Notes:" preamble before the real
     header. Find the header row, map its columns, and return contact objects. */
  parseLinkedIn(text) {
    const rows = this.parse(text);
    let headerIdx = -1;
    for (let i = 0; i < Math.min(rows.length, 10); i++) {
      const lower = rows[i].map(c => c.trim().toLowerCase());
      if (lower.includes('first name') && lower.includes('last name')) { headerIdx = i; break; }
    }
    if (headerIdx === -1) {
      return { error: 'No "First Name / Last Name" header row found — is this a LinkedIn connections export?' };
    }
    const header = rows[headerIdx].map(c => c.trim().toLowerCase());
    const col = name => header.indexOf(name);
    const idx = {
      first: col('first name'),
      last: col('last name'),
      url: col('url'),
      email: col('email address'),
      company: col('company'),
      position: col('position'),
      connected: col('connected on')
    };
    const contacts = [];
    let skipped = 0;
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const r = rows[i];
      if (r.length === 1 && r[0].trim() === '') continue; // blank line
      const get = j => (j >= 0 && r[j] != null) ? r[j].trim() : '';
      const firstName = get(idx.first), lastName = get(idx.last);
      if (!firstName && !lastName) { skipped++; continue; }
      contacts.push({
        firstName,
        lastName,
        linkedinUrl: get(idx.url),
        email: get(idx.email),
        company: get(idx.company),
        position: get(idx.position),
        connectedOn: get(idx.connected)
      });
    }
    return { contacts, skipped };
  }
};
