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
    const dispatchedPersonas = transcriptDispatchedPersonas(input.transcript_path, sessionStart);

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
      const reviewLogged = wasReallyDispatched('code-reviewer', dispatchedPersonas, reviewWindowStart);
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
      const releaseLogged = wasReallyDispatched('release-engineer', dispatchedPersonas, reviewWindowStart);
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
      const testLogged = wasReallyDispatched('test-engineer', dispatchedPersonas, reviewWindowStart);
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

// Real verification: parse the actual session transcript for Agent tool_use blocks with
// a matching subagent_type, instead of trusting a hand-writable decisions.jsonl line.
// code-reviewer's second pass flagged that the persona-field check alone is still
// gameable (write one JSON line, no real dispatch needed) — transcript_path is provided
// by Claude Code on the Stop hook input and reflects what tool calls actually happened,
// which can't be faked the same way. Returns a Set of persona names with a real Agent
// dispatch since sinceMs.
// Returns null if the transcript couldn't be read at all (caller should fall back to
// decisions.jsonl), or a Set (possibly empty) if it was read successfully — an empty Set
// is a real, trustworthy "nothing was dispatched," not a reason to fall back.
//
// Known limits (code-reviewer's third pass, kept deliberately rather than over-built):
// - Lines with malformed JSON or missing/unparseable `timestamp` are silently skipped.
//   A real dispatch could in theory be missed if its transcript line lacks a timestamp,
//   but Claude Code's assistant tool_use entries reliably carry one in practice.
// - Only the last MAX_SCAN_LINES lines are scanned (not the full file) — this gate only
//   needs recent activity (commit was just made, review window is ~30min), and a
//   multi-hour session's transcript can be tens of MB; full synchronous reads on every
//   Stop event would be wasteful. If a real dispatch happened far enough back to fall
//   outside both the line cap and the time window, this correctly treats it as stale.
// - Proves a dispatch HAPPENED, not that it was substantive — a rubber-stamp Agent call
//   with subagent_type:"code-reviewer" and a vacuous prompt still satisfies this check.
//   That's a real residual gap, accepted as a large improvement over hand-writable JSON
//   text, not a closure of "agent must do real work."
const MAX_SCAN_LINES = 4000;
function transcriptDispatchedPersonas(transcriptPath, sinceMs) {
  if (!transcriptPath || !fs.existsSync(transcriptPath)) return null;
  const found = new Set();
  try {
    const all = fs.readFileSync(transcriptPath, 'utf-8').trim().split('\n').filter(Boolean);
    const lines = all.length > MAX_SCAN_LINES ? all.slice(-MAX_SCAN_LINES) : all;
    for (const line of lines) {
      try {
        const e = JSON.parse(line);
        const ts = Date.parse(e.timestamp || 0);
        if (Number.isNaN(ts) || ts < sinceMs) continue;
        const content = e.message && e.message.content;
        if (!Array.isArray(content)) continue;
        for (const c of content) {
          if (c && c.type === 'tool_use' && c.name === 'Agent' && c.input && c.input.subagent_type) {
            found.add(String(c.input.subagent_type).toLowerCase());
          }
        }
      } catch {}
    }
  } catch {
    return null;
  }
  return found;
}

// Transcript verification is primary (can't be faked). Falls back to the decisions.jsonl
// persona-field check only when the transcript itself couldn't be read (null), not merely
// when it was empty of dispatches — an empty Set from a successfully-read transcript means
// "really wasn't dispatched," and must not silently fall through to the weaker check.
function wasReallyDispatched(persona, dispatchedPersonas, decisionsWindowStart) {
  if (dispatchedPersonas === null) {
    return countRecent(DECISIONS_LOG, decisionsWindowStart, e => loggedAsPersona(e, persona)) > 0;
  }
  return dispatchedPersonas.has(persona.toLowerCase());
}

// Require a structured `persona` field match, not a fuzzy substring search over the
// whole serialized entry — code-reviewer flagged that a junk line like
// {"note":"release-engineer noted, skipping"} could satisfy a substring check without
// any real dispatch happening. `decision`/`reason` must also be non-trivial (>20 chars)
// so a one-word stub can't pass either. This is now the fallback path only (see
// wasReallyDispatched) — transcript verification is primary.
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
