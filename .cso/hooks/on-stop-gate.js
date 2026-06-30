#!/usr/bin/env node
// Stop hook — HARD gate. Unlike on-learn-check.js (UserPromptSubmit, prints a
// warning the model can ignore), this returns {"decision":"block"} on the
// Stop event, which Claude Code enforces: the agent cannot end the turn until
// the reason is addressed. Root cause this fixes: CLAUDE.md/MEMORY.md prose
// rules get read once and dropped under task pressure (see
// feedback_unused_routing_table.md — a prose-only "fix" for this exact
// problem was added same-day and changed nothing).

const fs = require('fs');
const path = require('path');

const STATE_DIR = path.join(__dirname, '../state');
const FEEDBACK_LOG = path.join(STATE_DIR, 'feedback.jsonl');
const DECISIONS_LOG = path.join(STATE_DIR, 'decisions.jsonl');

async function main() {
  try {
    const raw = await readStdin();
    if (!raw) return done();
    const input = JSON.parse(raw);

    // Avoid infinite loop: if Claude Code is re-invoking us because we
    // already blocked once this turn, don't block again.
    if (input.stop_hook_active) return done();

    const sessionStart = Date.now() - 2 * 60 * 60 * 1000; // 2h lookback window

    const corrections = countRecent(FEEDBACK_LOG, sessionStart, e => e.type === 'dissatisfied');
    if (corrections === 0) return done();

    const memoryUpdated = checkMemoryUpdated(sessionStart);
    const learnLogged = countRecent(DECISIONS_LOG, sessionStart, e =>
      JSON.stringify(e).toLowerCase().includes('cso-learn')
    ) > 0;

    if (!memoryUpdated && !learnLogged) {
      return block(
        `${corrections} correction(s) logged in feedback.jsonl this session but no memory file was ` +
        `written and no decisions.jsonl entry shows /cso-learn ran. Run /cso-learn now, write the ` +
        `memory file(s), update MEMORY.md, then log a decisions.jsonl entry mentioning cso-learn ` +
        `before ending this turn.`
      );
    }

    return done();
  } catch (e) {
    return done(); // never crash the session over a hook bug
  }
}

function countRecent(file, sinceMs, predicate) {
  if (!fs.existsSync(file)) return 0;
  const lines = fs.readFileSync(file, 'utf-8').trim().split('\n').filter(Boolean);
  let n = 0;
  for (const line of lines) {
    try {
      const e = JSON.parse(line);
      const ts = Date.parse(e.timestamp || 0);
      if (ts >= sinceMs && predicate(e)) n++;
    } catch {}
  }
  return n;
}

function checkMemoryUpdated(sinceMs) {
  const cwd = process.cwd();
  const projectKey = cwd.replace(/[\/ ]/g, '-');
  const memoryDir = path.join(process.env.HOME || '/Users/manojaaa', '.claude/projects', projectKey, 'memory');
  if (!fs.existsSync(memoryDir)) return false;
  const files = fs.readdirSync(memoryDir).filter(f => f.endsWith('.md') && f !== 'MEMORY.md');
  for (const f of files) {
    if (fs.statSync(path.join(memoryDir, f)).mtimeMs >= sinceMs) return true;
  }
  return false;
}

function block(reason) {
  process.stdout.write(JSON.stringify({ decision: 'block', reason }));
  process.exit(0);
}

function done() {
  process.exit(0);
}

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', c => { data += c; });
    process.stdin.on('end', () => resolve(data));
    setTimeout(() => resolve(''), 100);
  });
}

main();
