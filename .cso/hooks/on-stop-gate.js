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
const { execSync } = require('child_process');

const STATE_DIR = path.join(__dirname, '../state');
const FEEDBACK_LOG = path.join(STATE_DIR, 'feedback.jsonl');
const DECISIONS_LOG = path.join(STATE_DIR, 'decisions.jsonl');
const REPO_ROOT = path.join(__dirname, '../..');

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

    // Second gate: a commit landed recently with no logged code-reviewer dispatch.
    // 2026-06-30 decision: stop letting "code-reviewer never invoked" be a standing
    // fact (see feedback_unused_routing_table.md) — user chose to actually start
    // dispatching it. Catch the highest-stakes case (shipped code) for real.
    const recentCommitMs = getLastCommitMs();
    if (recentCommitMs && recentCommitMs >= sessionStart && lastCommitTouchesCode()) {
      const reviewLogged = countRecent(DECISIONS_LOG, recentCommitMs - 30 * 60 * 1000, e =>
        JSON.stringify(e).toLowerCase().includes('code-reviewer')
      ) > 0;
      if (!reviewLogged) {
        return block(
          `A git commit landed at ${new Date(recentCommitMs).toISOString()} but no decisions.jsonl ` +
          `entry mentions code-reviewer. Dispatch the code-reviewer agent on the diff now and log a ` +
          `decisions.jsonl entry mentioning code-reviewer before ending this turn.`
        );
      }
    }

    return done();
  } catch (e) {
    return done(); // never crash the session over a hook bug
  }
}

function getLastCommitMs() {
  try {
    const iso = execSync('git log -1 --format=%cI', { cwd: REPO_ROOT, encoding: 'utf-8', timeout: 3000 }).trim();
    return iso ? new Date(iso).getTime() : null;
  } catch {
    return null;
  }
}

// Don't make the gate fire for doc/memory-only commits — that just trains the model to
// log a bogus "code-reviewer ran" entry to satisfy noise (code-reviewer flagged this).
function lastCommitTouchesCode() {
  try {
    const files = execSync('git show --name-only --format= HEAD', { cwd: REPO_ROOT, encoding: 'utf-8', timeout: 3000 })
      .trim().split('\n').filter(Boolean);
    return files.some(f => !/\.(md|jsonl?|gitignore)$/i.test(f) && !f.startsWith('home-dotclaude/memory/'));
  } catch {
    return true; // unknown -> safer to ask for review than silently skip
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
