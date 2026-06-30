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

// STATE_DIR/logs are always this repo's (.cso/state is shared across all workspaces by
// design). But git operations must use the ACTUAL session cwd, not this repo's path —
// hooks fire globally across every workspace, and a hardcoded repo path here would check
// commits in the wrong project entirely whenever working elsewhere.
const STATE_DIR = path.join(__dirname, '../state');
const FEEDBACK_LOG = path.join(STATE_DIR, 'feedback.jsonl');
const DECISIONS_LOG = path.join(STATE_DIR, 'decisions.jsonl');
const REPO_ROOT = process.cwd();

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
    const reviewWindowStart = recentCommitMs ? Math.max(recentCommitMs - 30 * 60 * 1000, sessionStart) : null;
    if (recentCommitMs && recentCommitMs >= sessionStart && lastCommitTouchesCode()) {
      const reviewLogged = countRecent(DECISIONS_LOG, reviewWindowStart, e => loggedAsPersona(e, 'code-reviewer')) > 0;
      if (!reviewLogged) {
        return block(
          `A git commit landed at ${new Date(recentCommitMs).toISOString()} but no decisions.jsonl ` +
          `entry mentions code-reviewer. Dispatch the code-reviewer agent on the diff now and log a ` +
          `decisions.jsonl entry mentioning code-reviewer before ending this turn.`
        );
      }
    }

    // Third gate: a commit touches deploy config (the repo is being shipped) with no
    // logged release-engineer dispatch.
    if (recentCommitMs && recentCommitMs >= sessionStart && lastCommitTouchesDeployConfig()) {
      const releaseLogged = countRecent(DECISIONS_LOG, reviewWindowStart, e => loggedAsPersona(e, 'release-engineer')) > 0;
      if (!releaseLogged) {
        return block(
          `A git commit at ${new Date(recentCommitMs).toISOString()} touches deploy config but no ` +
          `decisions.jsonl entry mentions release-engineer. Dispatch it and log before ending this turn.`
        );
      }
    }

    // Fourth gate: a commit touches app source in a repo with a real test script, no
    // logged test-engineer/verify pass.
    if (recentCommitMs && recentCommitMs >= sessionStart && lastCommitTouchesTestableCode()) {
      const testLogged = countRecent(DECISIONS_LOG, reviewWindowStart, e => loggedAsPersona(e, 'test-engineer')) > 0;
      if (!testLogged) {
        return block(
          `A git commit at ${new Date(recentCommitMs).toISOString()} touches testable app code in a repo ` +
          `with a real test script, but no decisions.jsonl entry is logged with persona:test-engineer. ` +
          `Run it (e.g. /verify) and log a decisions.jsonl entry with persona:"test-engineer" before ending this turn.`
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

function lastCommitFiles() {
  try {
    return execSync('git show --name-only --format= HEAD', { cwd: REPO_ROOT, encoding: 'utf-8', timeout: 3000 })
      .trim().split('\n').filter(Boolean);
  } catch {
    return null; // not a git repo / no commits — caller treats null as "no signal"
  }
}

function lastCommitTouchesDeployConfig() {
  const files = lastCommitFiles();
  if (!files) return false;
  return files.some(f => /(^|\/)(vercel\.json|railway\.(json|toml)|Dockerfile|render\.yaml|fly\.toml|\.github\/workflows\/.*\.ya?ml)$/i.test(f));
}

function lastCommitTouchesTestableCode() {
  const files = lastCommitFiles();
  if (!files) return false;
  const touchesSource = files.some(f =>
    /\.(js|jsx|ts|tsx|py|go|rb|java|rs)$/i.test(f) &&
    !f.startsWith('.cso/') && !f.includes('/hooks/') && !f.startsWith('hooks/') && !f.startsWith('home-dotclaude/')
  );
  if (!touchesSource) return false;
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf-8'));
    const testScript = pkg.scripts && pkg.scripts.test;
    // Reject placeholder scripts: npm's default "no test specified" AND any echo-only
    // stub declaring no real suite exists (e.g. this repo's own package.json — found
    // while building this gate, would have false-positived on itself).
    return !!testScript
      && !/no test specified/i.test(testScript)
      && !(/^echo\b/i.test(testScript.trim()) && /no\s+(unit\s+)?tests?/i.test(testScript));
  } catch {
    return false; // no package.json / no test script -> nothing to gate on
  }
}

// Require a structured `persona` field match, not a fuzzy substring search over the
// whole serialized entry — code-reviewer flagged that a junk line like
// {"note":"release-engineer noted, skipping"} could satisfy a substring check without
// any real dispatch happening. `decision`/`reason` must also be non-trivial (>20 chars)
// so a one-word stub can't pass either. This doesn't prove an Agent tool call actually
// ran, but it raises the bar from "any text anywhere" to "deliberately logged as this
// persona with a real description."
function loggedAsPersona(entry, persona) {
  if (!entry || typeof entry !== 'object') return false;
  const p = String(entry.persona || '').toLowerCase();
  if (p !== persona.toLowerCase()) return false;
  const text = String(entry.decision || entry.reason || '');
  return text.trim().length > 20;
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
