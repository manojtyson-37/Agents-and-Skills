#!/usr/bin/env node
// Append one decision record to the pattern ledger. Used by the decision-maker agent.
// Usage: node record-decision.js '{"context":"...","chosen":"...","decidedBy":"...","confidence":"...","rationale":"..."}'
const fs = require('fs');
const path = require('path');

const LEDGER = path.join(__dirname, 'decision_patterns.jsonl');

let rec;
try {
  rec = JSON.parse(process.argv[2] || '{}');
} catch (e) {
  console.error('record-decision: invalid JSON arg:', e.message);
  process.exit(1);
}
if (!rec.context || !rec.chosen) {
  console.error('record-decision: "context" and "chosen" are required');
  process.exit(1);
}

const entry = {
  timestamp: new Date().toISOString(),
  context: rec.context,
  options: rec.options || [],
  chosen: rec.chosen,
  decidedBy: rec.decidedBy || 'decision-maker',
  confidence: rec.confidence || 'medium',
  rationale: rec.rationale || '',
  reversible: rec.reversible !== false,
  override: rec.override === true,
};

fs.appendFileSync(LEDGER, JSON.stringify(entry) + '\n');
console.log('recorded:', entry.chosen, `(${entry.decidedBy}/${entry.confidence}${entry.override ? '/OVERRIDE' : ''})`);

// Auto-distill every 10 decisions (non-blocking background spawn)
try {
  const lineCount = fs.readFileSync(LEDGER, 'utf-8').trim().split('\n').filter(Boolean).length;
  if (lineCount > 0 && lineCount % 10 === 0) {
    const { spawn } = require('child_process');
    const distillScript = path.join(__dirname, 'distill-patterns.cjs');
    const child = spawn(process.execPath, [distillScript], {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
  }
} catch (_) {}

// demo/self-check: node record-decision.js --selftest
if (process.argv[2] === '--selftest') {
  const lines = fs.readFileSync(LEDGER, 'utf-8').trim().split('\n');
  const last = JSON.parse(lines[lines.length - 1]);
  if (!last.timestamp || !last.chosen) throw new Error('selftest failed: malformed entry');
  console.log('selftest OK');
}
