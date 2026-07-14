---
name: verify
description: How to run and verify changes to Job Search HQ (vanilla-JS static SPA, localStorage-backed) in a real browser.
---

# Verifying Job Search HQ changes

Static SPA — no build step, no deps. All state in localStorage key `career-dashboard-v1`.

## Launch

```bash
python3 -m http.server 8742   # run from repo root, in background
```

Then drive `http://localhost:8742/index.html` with the claude-in-chrome tools.
Serving over localhost gives the test run its **own localStorage origin**, isolated
from the user's real data (they open via file:// or another port). The gitignored
`personal-seed.js` / `hill-seed.js` auto-seed realistic data on first load.

## Gotchas

- **Never trigger `alert()`/`confirm()` through clicks** — they freeze the browser
  extension. Most delete buttons and dedupe paths use them. Stub first via
  javascript_tool: `window.__dialogs=[]; window.alert=m=>__dialogs.push(['alert',m]);
  window.confirm=m=>{__dialogs.push(['confirm',m]);return true;}` then assert on
  `window.__dialogs`. Stubs die on reload.
- Every input event re-renders the whole tab (innerHTML swap) — coordinates shift
  after each interaction; re-screenshot before clicking again.
- A nav click immediately after `navigate` races `DOMContentLoaded` — click tabs
  only after a screenshot confirms the app rendered.
- Chrome date inputs: type segment digits without slashes (`07082026`), and beware
  they accept 6-digit years (garbage like `102026-07-08` gets stored as-is).
- Native `<select>`s: click, then type-ahead letter + Return works.
- Check `Store.state` directly with javascript_tool when display and data might
  disagree (e.g. sort-order questions).
- Clean up after: reset theme, remove test records via javascript_tool
  (`Store.save(); App.render()`), kill the server.

## Standard flows worth driving

Tab switch → toolbar search (focus must survive re-render — type several chars,
all must land) → add-form save → card click opens drawer → drawer field edits
(`data-*` change listeners, fire on blur) → reload for persistence → Settings
theme toggle (light + dark) → console error sweep (`read_console_messages`).
