#!/usr/bin/env node
// Append a RICH session checkpoint so the next session resumes with full context.
// CSO calls this at "CSO: Complete." (NOTIFY phase).
// Usage: node log-session.cjs '{"summary":"...","openThreads":["..."],"nextActions":["..."]}'
const fs = require('fs');
const path = require('path');

const LOG = path.join(__dirname, '../state/session_log.jsonl');

let rec;
try { rec = JSON.parse(process.argv[2] || '{}'); } catch (e) {
  console.error('log-session: invalid JSON:', e.message); process.exit(1);
}
if (!rec.summary) { console.error('log-session: "summary" required'); process.exit(1); }

const entry = {
  kind: 'rich',
  timestamp: new Date().toISOString(),
  summary: rec.summary,                 // what happened this session (2-4 sentences)
  openThreads: rec.openThreads || [],   // unfinished / dangling items
  nextActions: rec.nextActions || [],   // what to do next session
  objective: rec.objective || '',
  progress: rec.progress || '',
};
fs.mkdirSync(path.dirname(LOG), { recursive: true });
fs.appendFileSync(LOG, JSON.stringify(entry) + '\n');
console.log('session checkpoint (rich) written:', entry.summary.slice(0, 60));
