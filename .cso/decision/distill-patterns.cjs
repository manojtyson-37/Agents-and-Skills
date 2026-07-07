#!/usr/bin/env node
// Distill decision_patterns.jsonl into candidate rules for user_decision_profile.md
// Run: node distill-patterns.cjs
// Non-destructive: never edits existing profile rules, only appends candidates.

const fs = require('fs');
const path = require('path');

const LEDGER   = path.join(__dirname, 'decision_patterns.jsonl');
const PROFILE  = path.join(__dirname, 'user_decision_profile.md');
const STATE    = path.join(__dirname, '.distill-state.json');

const MIN_OCCURRENCES = 3;
const SECTION_HEADER  = '## Candidate rules (auto-distilled)';

// --- Load ledger ---
if (!fs.existsSync(LEDGER)) {
  console.log('distill-patterns: ledger not found, nothing to do.');
  process.exit(0);
}

const lines = fs.readFileSync(LEDGER, 'utf-8').trim().split('\n').filter(Boolean);
if (lines.length === 0) {
  console.log('distill-patterns: ledger is empty.');
  process.exit(0);
}

// --- Load already-added pattern keys ---
let state = { added: [] };
if (fs.existsSync(STATE)) {
  try { state = JSON.parse(fs.readFileSync(STATE, 'utf-8')); } catch {}
}
const alreadyAdded = new Set(state.added || []);

// --- Group by context ---
// Map: context -> { chosen: { value: count }, confidence: { high: N, medium: N, low: N } }
const groups = new Map();

for (const line of lines) {
  let rec;
  try { rec = JSON.parse(line); } catch { continue; }
  if (!rec.context || !rec.chosen) continue;

  if (!groups.has(rec.context)) {
    groups.set(rec.context, { chosen: {}, confidence: { high: 0, medium: 0, low: 0 } });
  }
  const g = groups.get(rec.context);
  g.chosen[rec.chosen] = (g.chosen[rec.chosen] || 0) + 1;
  const conf = (rec.confidence || 'medium').toLowerCase();
  if (conf in g.confidence) g.confidence[conf]++;
}

// --- Find candidates ---
const candidates = [];

for (const [context, g] of groups.entries()) {
  const total = Object.values(g.chosen).reduce((a, b) => a + b, 0);
  if (total < MIN_OCCURRENCES) continue;

  // Majority confidence check: high must be > 50%
  const highPct = Math.round((g.confidence.high / total) * 100);
  if (highPct <= 50) continue;

  // Most common chosen value
  const topChosen = Object.entries(g.chosen).sort((a, b) => b[1] - a[1])[0][0];

  // Build a stable key to deduplicate
  const key = `${context}::${topChosen}`;
  if (alreadyAdded.has(key)) continue;

  candidates.push({ context, topChosen, total, highPct, key });
}

if (candidates.length === 0) {
  console.log(`distill-patterns: 0 new candidates (${groups.size} context groups evaluated).`);
  process.exit(0);
}

// --- Read current profile ---
let profile = fs.existsSync(PROFILE) ? fs.readFileSync(PROFILE, 'utf-8') : '';

// Ensure section exists
if (!profile.includes(SECTION_HEADER)) {
  profile = profile.trimEnd() + '\n\n' + SECTION_HEADER + '\n';
}

// Append each new candidate
const lines_to_add = candidates.map(c =>
  `- [${c.context}]: ${c.topChosen} (seen ${c.total} times, high-confidence: ${c.highPct}%)`
);

profile = profile.trimEnd() + '\n' + lines_to_add.join('\n') + '\n';
fs.writeFileSync(PROFILE, profile);

// --- Persist state ---
state.added = [...alreadyAdded, ...candidates.map(c => c.key)];
state.lastRun = new Date().toISOString();
fs.writeFileSync(STATE, JSON.stringify(state, null, 2));

console.log(`distill-patterns: added ${candidates.length} new candidate rule(s) to user_decision_profile.md`);
candidates.forEach(c => console.log(`  + [${c.context}] → ${c.topChosen} (n=${c.total}, high=${c.highPct}%)`));
