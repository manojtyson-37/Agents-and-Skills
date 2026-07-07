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
const { checkMemoryUpdated, logHookEvent } = require('./cso-utils');

// STATE_DIR/logs are always this repo's (.cso/state is shared across all workspaces by
// design). But git operations must use the ACTUAL session cwd, not this repo's path —
// hooks fire globally across every workspace, and a hardcoded repo path here would check
// commits in the wrong project entirely whenever working elsewhere.
const STATE_DIR = path.join(__dirname, '../state');
const FEEDBACK_LOG = path.join(STATE_DIR, 'feedback.jsonl');
const DECISIONS_LOG = path.join(STATE_DIR, 'decisions.jsonl');
const REPO_ROOT = process.cwd();
const SMALL_CHANGE_MAX_LINES = 15;
const SMALL_CHANGE_MAX_FILES = 1;
const MAX_SCAN_LINES = 4000;

async function main() {
  try {
    const raw = await readStdin();
    if (!raw) return done();
    const input = JSON.parse(raw);

    // Avoid infinite loop: if Claude Code is re-invoking us because we
    // already blocked once this turn, don't block again.
    if (input.stop_hook_active) return done();

    // Use session_start_ms when provided so all gates share the real session boundary.
    // Without this, sessions >2h would use a stale 2h window for gates 1-7.
    // Known limitation: if session_start_ms is absent (Claude Code version gap), the 2h
    // fallback means early-session work may be missed for sessions longer than 2h.
    const sessionStart = (input.session_start_ms && typeof input.session_start_ms === 'number')
      ? input.session_start_ms
      : Date.now() - 2 * 60 * 60 * 1000;
    const dispatchedPersonas = transcriptDispatchedPersonas(input.transcript_path, sessionStart);

    // Gate 0: ACTION REQUIRED inbox task must be addressed before ending session.
    // Root cause this fixes: session-start hook surfaces escalated inbox tasks as
    // "Start this NOW" but nothing enforces that — the LLM reads it, says "noted",
    // and responds as chatbot. This gate blocks Stop if there's an escalated inbox
    // task with no decisions.jsonl entry proving it was addressed (started, deferred
    // with reason, or completed) this session.
    // sessionStart already incorporates session_start_ms (set at top of main()).
    {
      const gate0Start = sessionStart;
      const inboxPath = path.join(STATE_DIR, 'inbox.json');
      if (fs.existsSync(inboxPath)) {
        try {
          const inbox = JSON.parse(fs.readFileSync(inboxPath, 'utf-8'));
          const tasks = inbox.tasks || [];
          // Find unique workflows that are escalated + still pending.
          // Skip tasks where wfId is falsy — no stable key, can't track or display meaningfully.
          const escalatedWorkflows = new Map();
          for (const t of tasks) {
            if (t.status === 'pending' && t.priority === 'escalated') {
              const wfId = t.workflowId || t.id;
              if (!wfId) continue;
              if (!escalatedWorkflows.has(wfId)) {
                escalatedWorkflows.set(wfId, t.workflowObjective || t.objective || '');
              }
            }
          }
          if (escalatedWorkflows.size > 0) {
            // Check decisions.jsonl: an entry qualifies if it was written this session AND
            // has context:"inbox-escalated" AND its workflowId field matches exactly.
            // Objective substring is a fallback only when objective is long enough (>=40 chars)
            // to be unambiguous — prevents generic prefixes from clearing unrelated tasks.
            const addressed = new Set();
            if (fs.existsSync(DECISIONS_LOG)) {
              const allLines = fs.readFileSync(DECISIONS_LOG, 'utf-8').trim().split('\n').filter(Boolean);
              const lines = allLines.length > MAX_SCAN_LINES ? allLines.slice(-MAX_SCAN_LINES) : allLines;
              for (const line of lines) {
                try {
                  const e = JSON.parse(line);
                  // Fix: use ternary so missing timestamp → 0 (old), not NaN (passes filter)
                  const ts = e.timestamp ? Date.parse(e.timestamp) : 0;
                  if (isNaN(ts) || ts < gate0Start) continue;
                  if (e.context !== 'inbox-escalated') continue;
                  for (const [wfId, obj] of escalatedWorkflows) {
                    // Primary: structured workflowId field match (exact, not substring)
                    if (e.workflowId && String(e.workflowId).toLowerCase() === wfId.toLowerCase()) {
                      addressed.add(wfId);
                      continue;
                    }
                    // Fallback: objective substring only when long enough to be unambiguous,
                    // scoped to known fields — avoids matching inside unrelated rationale text.
                    if (obj && obj.length >= 40) {
                      const needle = obj.toLowerCase().slice(0, 50);
                      const hayFields = [e.workflowObjective, e.objective, e.context, e.rationale, e.decision]
                        .filter(Boolean).join(' ').toLowerCase();
                      if (hayFields.includes(needle)) addressed.add(wfId);
                    }
                  }
                } catch {}
              }
            }
            const unaddressed = [...escalatedWorkflows.entries()].filter(([id]) => !addressed.has(id));
            if (unaddressed.length > 0) {
              const list = unaddressed.map(([id, obj]) => `• ${(obj || id).slice(0, 80)}`).join('\n');
              logHookEvent('on-stop-gate', 'gate-0-inbox', 'blocked', `${unaddressed.length} escalated task(s) unaddressed`);
              return block(
                `${unaddressed.length} escalated inbox task(s) were surfaced at session start but not addressed:\n${list}\n\n` +
                `REQUIRED before ending this turn: either (a) start the task (write a plan to workflow_state.json and begin), ` +
                `or (b) explicitly defer it with a reason by logging a decisions.jsonl entry with ` +
                `{"timestamp":"...","context":"inbox-escalated","workflowId":"<exact id>","chosen":"deferred","rationale":"<real reason>"}. ` +
                `workflowId values: ${unaddressed.map(([id]) => id).join(', ')}. ` +
                `Ignoring escalated tasks is not allowed — address or formally defer each one.`
              );
            }
          }
        } catch {}
      }
    }
    logHookEvent('on-stop-gate', 'gate-0-inbox', 'passed', '');

    // Self-repair gate: CSO-detected self-repair tasks must be addressed before session end.
    // Root cause this fixes: self-repair tasks were being bulk-cancelled with user inbox tasks,
    // meaning CSO detected its own failures but never fixed them. Self-repair tasks have
    // source:"self-repair" in inbox.json. They must be executed or formally deferred this session.
    {
      const inboxPath = path.join(STATE_DIR, 'inbox.json');
      if (fs.existsSync(inboxPath)) {
        try {
          const inbox = JSON.parse(fs.readFileSync(inboxPath, 'utf-8'));
          const selfRepairPending = (inbox.tasks || []).filter(
            t => t.status === 'pending' && t.source === 'self-repair' && t.id
          );
          if (selfRepairPending.length > 0) {
            // Check if addressed this session via decisions.jsonl
            const addressed = new Set();
            if (fs.existsSync(DECISIONS_LOG)) {
              const allLines = fs.readFileSync(DECISIONS_LOG, 'utf-8').trim().split('\n').filter(Boolean);
              const lines = allLines.length > MAX_SCAN_LINES ? allLines.slice(-MAX_SCAN_LINES) : allLines;
              for (const line of lines) {
                try {
                  const e = JSON.parse(line);
                  const ts = e.timestamp ? Date.parse(e.timestamp) : 0;
                  if (isNaN(ts) || ts < sessionStart) continue;
                  // Mark addressed if decisions.jsonl has an entry referencing this task id
                  for (const t of selfRepairPending) {
                    if (e.selfRepairId === t.id || (e.decision && e.decision.includes(t.id))) {
                      addressed.add(t.id);
                    }
                  }
                } catch {}
              }
            }
            const unaddressed = selfRepairPending.filter(t => !addressed.has(t.id));
            if (unaddressed.length > 0) {
              const list = unaddressed.map(t => `• [${t.category || 'unknown'}] ${t.title || t.id}`).join('\n');
              logHookEvent('on-stop-gate', 'gate-0b-self-repair', 'blocked', `${unaddressed.length} self-repair task(s) unaddressed`);
              return block(
                `${unaddressed.length} self-repair task(s) from CSO's own gap-detection are pending and unaddressed:\n${list}\n\n` +
                `These represent known CSO failures that must not be silently dropped. Either:\n` +
                `(a) Execute the fix now, or\n` +
                `(b) Log a decisions.jsonl entry with {"selfRepairId":"<id>","decision":"deferred","rationale":"<real reason>","timestamp":"..."}\n` +
                `Task IDs: ${unaddressed.map(t => t.id).join(', ')}`
              );
            }
          }
        } catch {}
      }
    }
    logHookEvent('on-stop-gate', 'gate-0b-self-repair', 'passed', '');

    // First gate: learning pass — REQUIRED whenever workflow was active this session OR
    // corrections were logged. "Continuous learning agent" means cso-learn runs every session
    // that touched real work, not just sessions with dissatisfied feedback.
    // BUG FIXED 2026-06-30: this used to short-circuit all gates below it — fixed then.
    // 2026-07-08: strengthened: fire when workflow was touched OR corrections > 0.
    const corrections = countRecent(FEEDBACK_LOG, sessionStart, e => e.type === 'dissatisfied');
    const wfPathForLearn = path.join(STATE_DIR, 'workflow_state.json');
    const workflowActivethisSession = fs.existsSync(wfPathForLearn) &&
      fs.statSync(wfPathForLearn).mtimeMs >= sessionStart;
    if (corrections > 0 || workflowActivethisSession) {
      const memoryUpdated = checkMemoryUpdated(sessionStart);
      const learnLogged = countRecent(DECISIONS_LOG, sessionStart, e =>
        JSON.stringify(e).toLowerCase().includes('cso-learn')
      ) > 0;

      if (!memoryUpdated && !learnLogged) {
        const trigger = corrections > 0
          ? `${corrections} correction(s) logged in feedback.jsonl`
          : `workflow was active this session`;
        logHookEvent('on-stop-gate', 'gate-1-learning', 'blocked', trigger);
        return block(
          `${trigger} but no /cso-learn pass ran this session. CSO is a continuous learning agent — ` +
          `run /cso-learn now, write any new memory file(s), update MEMORY.md, then log a decisions.jsonl ` +
          `entry mentioning "cso-learn" before ending this turn.`
        );
      }
      logHookEvent('on-stop-gate', 'gate-1-learning', 'passed', 'learn logged or memory updated');
    } else {
      logHookEvent('on-stop-gate', 'gate-1-learning', 'skipped', 'no corrections and no workflow activity');
    }

    // Second gate: a commit landed recently with no logged code-reviewer dispatch.
    // 2026-06-30 decision: stop letting "code-reviewer never invoked" be a standing
    // fact (see feedback_unused_routing_table.md) — user chose to actually start
    // dispatching it. Catch the highest-stakes case (shipped code) for real.
    const recentCommitMs = getLastCommitMs();
    const reviewWindowStart = recentCommitMs ? Math.max(recentCommitMs - 30 * 60 * 1000, sessionStart) : null;
    if (recentCommitMs && recentCommitMs >= sessionStart && lastCommitTouchesCode()) {
      const fullDispatched = wasReallyDispatched('code-reviewer', dispatchedPersonas, reviewWindowStart);
      // 2026-06-30: user said cost is low priority but explicitly does not want a
      // ~25-40k-token Agent dispatch for every small change. Small + non-infra commits
      // get a cheaper path: a logged self-review with selfReviewed:true (structured
      // field, not fuzzy text — same lesson as loggedAsPersona). Infra files
      // (.cso/hooks/*, dashboard/server.js) are EXCLUDED from this fast path regardless
      // of size — every "small-looking" diff in those files this session had a real,
      // sometimes blocking bug a self-review missed and only a real dispatch caught.
      const selfReviewOk = isSmallNonInfraCommit() &&
        countRecent(DECISIONS_LOG, reviewWindowStart, e => loggedSelfReview(e)) > 0;
      if (!fullDispatched && !selfReviewOk) {
        const stats = lastCommitDiffStats();
        const sizeNote = stats ? ` (${stats.files} file(s), ${stats.totalLines} line(s) changed)` : '';
        logHookEvent('on-stop-gate', 'gate-2-code-review', 'blocked', 'commit landed with no review');
        return block(
          `A git commit landed at ${new Date(recentCommitMs).toISOString()}${sizeNote} with no logged ` +
          `review. Either: (a) dispatch the code-reviewer agent and it'll be picked up via transcript, ` +
          `or (b) if this is a small, non-infra change (not touching .cso/hooks/ or dashboard/server.js, ` +
          `single file, <=${SMALL_CHANGE_MAX_LINES} lines), self-review it yourself and log a ` +
          `decisions.jsonl entry with {"selfReviewed":true,"persona":"engineer","decision":"<real ` +
          `reasoning, what you checked>"} before ending this turn.`
        );
      }
      logHookEvent('on-stop-gate', 'gate-2-code-review', 'passed', fullDispatched ? 'code-reviewer dispatched' : 'small non-infra self-review');
    } else {
      logHookEvent('on-stop-gate', 'gate-2-code-review', 'skipped', 'no qualifying commit');
    }

    // Third gate: a commit touches deploy config (the repo is being shipped) with no
    // logged release-engineer dispatch.
    if (recentCommitMs && recentCommitMs >= sessionStart && lastCommitTouchesDeployConfig()) {
      const releaseLogged = wasReallyDispatched('release-engineer', dispatchedPersonas, reviewWindowStart);
      if (!releaseLogged) {
        logHookEvent('on-stop-gate', 'gate-3-deploy-config', 'blocked', 'deploy config commit with no release-engineer dispatch');
        return block(
          `A git commit at ${new Date(recentCommitMs).toISOString()} touches deploy config but no ` +
          `decisions.jsonl entry mentions release-engineer. Dispatch it and log before ending this turn.`
        );
      }
      logHookEvent('on-stop-gate', 'gate-3-deploy-config', 'passed', 'release-engineer dispatched');
    } else {
      logHookEvent('on-stop-gate', 'gate-3-deploy-config', 'skipped', 'no deploy config commit');
    }

    // Fourth gate: a commit touches app source in a repo with a real test script, no
    // logged test-engineer/verify pass.
    if (recentCommitMs && recentCommitMs >= sessionStart && lastCommitTouchesTestableCode()) {
      const testLogged = wasReallyDispatched('test-engineer', dispatchedPersonas, reviewWindowStart);
      if (!testLogged) {
        logHookEvent('on-stop-gate', 'gate-4-test-engineer', 'blocked', 'testable code commit with no test-engineer pass');
        return block(
          `A git commit at ${new Date(recentCommitMs).toISOString()} touches testable app code in a repo ` +
          `with a real test script, but no decisions.jsonl entry is logged with persona:test-engineer. ` +
          `Run it (e.g. /verify) and log a decisions.jsonl entry with persona:"test-engineer" before ending this turn.`
        );
      }
      logHookEvent('on-stop-gate', 'gate-4-test-engineer', 'passed', 'test-engineer dispatched');
    } else {
      logHookEvent('on-stop-gate', 'gate-4-test-engineer', 'skipped', 'no testable code commit');
    }

    // Fifth gate: a code commit landed but CSO state files were not updated this session.
    // workflow_state.json and task_history.jsonl are required after every task. Skipping
    // them means the dashboard goes dark and next-session recovery is impossible.
    // Window: state files must have been touched within 10 min before the commit or any
    // time after it (covers both "log then commit" and "commit then log" orderings).
    if (recentCommitMs && recentCommitMs >= sessionStart && lastCommitTouchesCode()) {
      const stateWindow = recentCommitMs - 10 * 60 * 1000;
      const wfPath = path.join(STATE_DIR, 'workflow_state.json');
      const thPath = path.join(STATE_DIR, 'task_history.jsonl');
      // Skip state-file gates when no CSO workflow ran this session — conversational
      // sessions (questions, audits, reviews) commit code without creating a workflow.
      // Use session-window mtime on both files: if neither was touched since sessionStart,
      // no workflow was active and the gates don't apply. Existence-only check is weaker:
      // the files persist across sessions, so wfExists is almost always true, meaning
      // a real workflow session that deletes/corrupts workflow_state.json would bypass both.
      const wfTouchedThisSession = fs.existsSync(wfPath) && fs.statSync(wfPath).mtimeMs >= sessionStart;
      const thTouchedThisSession = fs.existsSync(thPath) && fs.statSync(thPath).mtimeMs >= sessionStart;
      if (!wfTouchedThisSession && !thTouchedThisSession) {
        // Neither state file touched this session → no workflow ran → gates do not apply.
      } else {
        const wfUpdated = fs.existsSync(wfPath) && fs.statSync(wfPath).mtimeMs >= stateWindow;
        const thUpdated = fs.existsSync(thPath) && fs.statSync(thPath).mtimeMs >= stateWindow;
        if (!wfUpdated) {
          logHookEvent('on-stop-gate', 'gate-5-state-files', 'blocked', 'workflow_state.json not updated after commit');
          return block(
            `A git commit landed at ${new Date(recentCommitMs).toISOString()} but workflow_state.json ` +
            `was not updated this session. Update it (set the task to completed, move inProgressTask) ` +
            `before ending this turn. Path: ${wfPath}`
          );
        }
        if (!thUpdated) {
          logHookEvent('on-stop-gate', 'gate-5-state-files', 'blocked', 'task_history.jsonl not updated after commit');
          return block(
            `A git commit landed at ${new Date(recentCommitMs).toISOString()} but task_history.jsonl ` +
            `has not been appended this session. Log the completed task ` +
            `({"timestamp":"...","task":"...","status":"completed","persona":"engineer","commit":"..."}) ` +
            `before ending this turn. Path: ${thPath}`
          );
        }
        logHookEvent('on-stop-gate', 'gate-5-state-files', 'passed', 'workflow_state and task_history updated');
      }
    } else {
      logHookEvent('on-stop-gate', 'gate-5-state-files', 'skipped', 'no qualifying commit');
    }

    // Fifth-B gate: workflow stuck in bootstrapping with 0 tasks at session end.
    // Root cause of "workflow state decorative" — hook creates workflow, model does real work,
    // but never writes tasks to workflow_state.json, leaving it perpetually bootstrapping.
    // Only fires when real work happened (commit landed) — idle sessions are fine to abandon.
    const wfPath = path.join(STATE_DIR, 'workflow_state.json');
    if (recentCommitMs && recentCommitMs >= sessionStart && fs.existsSync(wfPath)) {
      try {
        const wf = JSON.parse(fs.readFileSync(wfPath, 'utf-8'));
        const isGhostBootstrap = wf.status === 'bootstrapping' && Object.keys(wf.tasks || {}).length === 0;
        if (isGhostBootstrap) {
          logHookEvent('on-stop-gate', 'gate-5b-ghost-bootstrap', 'blocked', 'workflow stuck in bootstrapping with 0 tasks after commit');
          return block(
            `Workflow is still in "bootstrapping" state with 0 tasks, but real work (commit) happened ` +
            `this session. Either: (a) write the task plan to workflow_state.json ` +
            `(set status:"in-progress", populate tasks:{}, set inProgressTask), ` +
            `or (b) set status:"abandoned" to explicitly close it. ` +
            `Path: ${wfPath}`
          );
        }
        logHookEvent('on-stop-gate', 'gate-5b-ghost-bootstrap', 'passed', 'workflow has tasks or is not bootstrapping');
      } catch {
        logHookEvent('on-stop-gate', 'gate-5b-ghost-bootstrap', 'skipped', 'workflow_state.json unreadable');
      }
    } else {
      logHookEvent('on-stop-gate', 'gate-5b-ghost-bootstrap', 'skipped', 'no qualifying commit or no workflow file');
    }

    // Sixth gate: commit touches UI/app code but no local verify happened this session.
    // The prod-verify gate (below) only fires on push — this catches the earlier failure:
    // model commits broken UI without ever running the dev server or taking a screenshot.
    // Scope: only UI-adjacent files (.tsx/.jsx/.css/.html/.vue/.svelte) outside hooks/config.
    // Hook-only and pure backend commits are excluded — they don't need a browser check.
    if (recentCommitMs && recentCommitMs >= sessionStart && lastCommitTouchesPreviewableCode()) {
      const localVerified = transcriptHasLocalVerify(input.transcript_path, sessionStart);
      if (!localVerified) {
        logHookEvent('on-stop-gate', 'gate-6-local-verify', 'blocked', 'UI commit with no local preview screenshot');
        return block(
          `A commit at ${new Date(recentCommitMs).toISOString()} touches UI/app code but no local ` +
          `verification was found this session. REQUIRED: start the dev server (preview_start), ` +
          `take a screenshot (preview_screenshot), and confirm the change looks correct before ` +
          `committing. Run /verify or use preview_* tools, then end this turn.`
        );
      }
      logHookEvent('on-stop-gate', 'gate-6-local-verify', 'passed', 'local preview screenshot found');
    } else {
      logHookEvent('on-stop-gate', 'gate-6-local-verify', 'skipped', 'no previewable code commit');
    }

    // Seventh gate: code was pushed to remote (HEAD == remote) but no Chrome MCP prod verify
    // call appears in the transcript after the commit. Every push to this Vercel-deployed
    // repo requires a location.reload(true) and at least one page read to confirm prod state.
    // Only fires when HEAD matches remote (i.e., push already happened this session).
    // EXEMPTION: CSO infrastructure paths (.cso/, home-dotclaude/) are not deployed to Vercel —
    // hook-only commits must not trigger prod-verify. Use lastCommitTouchesDeployedAppCode()
    // not lastCommitTouchesCode() here (the latter returns true for .cso/hooks/*.js).
    if (recentCommitMs && recentCommitMs >= sessionStart && lastCommitTouchesDeployedAppCode() && isPushedToRemote()) {
      const prodVerified = transcriptHasProdVerify(input.transcript_path, recentCommitMs);
      if (!prodVerified) {
        logHookEvent('on-stop-gate', 'gate-7-prod-verify', 'blocked', 'push detected but no prod screenshot found');
        return block(
          `A push is detected (local HEAD matches remote) for commit at ` +
          `${new Date(recentCommitMs).toISOString()} but no real prod verification was found. ` +
          `REQUIRED: (1) navigate to prod URL in Chrome MCP, (2) open the changed UI, ` +
          `(3) take a screenshot (computer action=screenshot, save_to_disk=true) — DOM inspection ` +
          `and deploy status checks do NOT count. For mobile UI: resize to 390x844 first. ` +
          `Show the screenshot before ending this turn.`
        );
      }
      logHookEvent('on-stop-gate', 'gate-7-prod-verify', 'passed', 'prod screenshot verified');
    } else {
      logHookEvent('on-stop-gate', 'gate-7-prod-verify', 'skipped', 'no pushed deployed-app commit');
    }

    logHookEvent('on-stop-gate', 'all-gates', 'passed', 'all gates cleared');
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

// Infra paths always require full review regardless of size — this session's own
// evidence: every "small-looking" diff to .cso/hooks/*.js had a real bug (flat-vs-nested
// JSON schema, title-collision merging, gameable substring match) that a quick self-check
// would plausibly have missed. The cost of a wrong hook is "silently stops enforcing
// anything"; that's not a place to cut review cost.
function touchesReviewExemptInfra(files) {
  // Lowercase both sides — code-reviewer found that a wrongly-cased path (e.g.
  // "Dashboard/Server.js", a plausible typo/copy-paste artifact) would silently bypass
  // the exact-match/startsWith checks on case-sensitive filesystems, defeating the entire
  // point of this exclusion for exactly the files it exists to protect.
  return files.some(f => {
    const lf = f.toLowerCase();
    return lf.startsWith('.cso/hooks/') || lf === 'dashboard/server.js' || lf.startsWith('bootstrap.sh');
  });
}

function lastCommitDiffStats() {
  try {
    const out = execSync('git show --shortstat --format= HEAD', { cwd: REPO_ROOT, encoding: 'utf-8', timeout: 3000 }).trim();
    const files = lastCommitFiles() || [];
    const insertions = (out.match(/(\d+) insertion/) || [])[1];
    const deletions = (out.match(/(\d+) deletion/) || [])[1];
    const totalLines = (parseInt(insertions || '0', 10)) + (parseInt(deletions || '0', 10));
    return { files: files.length, totalLines };
  } catch {
    return null;
  }
}

function isSmallNonInfraCommit() {
  const files = lastCommitFiles();
  if (!files || files.length === 0) return false;
  if (touchesReviewExemptInfra(files)) return false;
  const stats = lastCommitDiffStats();
  if (!stats) return false;
  return stats.files <= SMALL_CHANGE_MAX_FILES && stats.totalLines <= SMALL_CHANGE_MAX_LINES;
}

// Structured field, not fuzzy text search — same lesson as loggedAsPersona(). BUT this
// is NOT equivalent rigor to a real code-reviewer dispatch: the same model writes both
// the commit and this log entry in the same turn, with no independent check (unlike
// wasReallyDispatched(), which verifies against the transcript). The >20-char floor only
// rules out empty/one-word stubs — it does not verify the reasoning is real or correct.
// This is a deliberate, weaker, cheaper gate for small non-infra changes per the user's
// explicit cost tradeoff (2026-06-30) — accept that someone could satisfy it with vague
// text, don't read it as proof of substantive review.
function loggedSelfReview(entry) {
  if (!entry || typeof entry !== 'object') return false;
  if (entry.selfReviewed !== true) return false;
  const text = String(entry.decision || entry.reason || '');
  return text.trim().length > 20;
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

// Deployed app code = files that actually end up on Vercel.
// Excludes CSO infrastructure (.cso/, home-dotclaude/) — those are never deployed.
// Gate 7 (prod-verify) uses this instead of lastCommitTouchesCode() to avoid
// false-positive prod-verify blocks on hook-only commits.
function lastCommitTouchesDeployedAppCode() {
  const files = lastCommitFiles();
  if (!files) return false;
  return files.some(f =>
    !/\.(md|jsonl?|gitignore)$/i.test(f) &&
    !f.startsWith('.cso/') &&
    !f.startsWith('home-dotclaude/')
  );
}

function lastCommitTouchesPreviewableCode() {
  const files = lastCommitFiles();
  if (!files) return false;
  return files.some(f =>
    /\.(tsx|jsx|css|scss|html|vue|svelte)$/i.test(f) &&
    !f.startsWith('.cso/') && !f.startsWith('home-dotclaude/')
  );
}

// Checks transcript for any preview_screenshot call this session — proof the dev server
// was running and the UI was visually checked before committing.
function transcriptHasLocalVerify(transcriptPath, sinceMs) {
  if (!transcriptPath || !fs.existsSync(transcriptPath)) return false;
  try {
    const all = fs.readFileSync(transcriptPath, 'utf-8').trim().split('\n').filter(Boolean);
    const lines = all.length > MAX_SCAN_LINES ? all.slice(-MAX_SCAN_LINES) : all;
    for (const line of lines) {
      try {
        const e = JSON.parse(line);
        const ts = e.timestamp ? Date.parse(e.timestamp) : 0;
        if (Number.isNaN(ts) || ts < sinceMs) continue;
        const content = e.message && e.message.content;
        if (!Array.isArray(content)) continue;
        for (const c of content) {
          if (!c || c.type !== 'tool_use') continue;
          const name = (c.name || '').toLowerCase();
          if (name === 'mcp__claude_preview__preview_screenshot') return true;
          if (name === 'mcp__claude_in_chrome__computer' && c.input && c.input.action === 'screenshot') return true;
        }
      } catch {}
    }
  } catch {}
  return false;
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
function transcriptDispatchedPersonas(transcriptPath, sinceMs) {
  if (!transcriptPath || !fs.existsSync(transcriptPath)) return null;
  const found = new Set();
  try {
    const all = fs.readFileSync(transcriptPath, 'utf-8').trim().split('\n').filter(Boolean);
    const lines = all.length > MAX_SCAN_LINES ? all.slice(-MAX_SCAN_LINES) : all;
    for (const line of lines) {
      try {
        const e = JSON.parse(line);
        const ts = e.timestamp ? Date.parse(e.timestamp) : 0;
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

// checkMemoryUpdated — imported from cso-utils.js

// Returns true if local HEAD matches the upstream remote branch (i.e., a push happened).
// False if ahead (not yet pushed), no remote, or git error (safe: no false gate).
function isPushedToRemote() {
  try {
    const status = execSync('git status -sb', { cwd: REPO_ROOT, encoding: 'utf-8', timeout: 3000 });
    if (status.includes('ahead')) return false; // unpushed commits
    // Verify a remote actually exists and HEAD has a tracking branch
    const remote = execSync('git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null || echo ""',
      { cwd: REPO_ROOT, encoding: 'utf-8', timeout: 3000, shell: true }).trim();
    return remote.length > 0;
  } catch {
    return false; // no git / no remote → don't fire gate
  }
}

// Scans transcript for real prod verification: requires a screenshot (computer
// action=screenshot), not just DOM inspection (javascript_tool/read_page).
// Lesson 2026-07-01: navigate + DOM inspection passed this check but failed the
// user — NavBar z-index bug was invisible without a visual screenshot. Screenshot
// is the only proof that counts for UI changes.
function transcriptHasProdVerify(transcriptPath, sinceMs) {
  if (!transcriptPath || !fs.existsSync(transcriptPath)) return false;
  try {
    const all = fs.readFileSync(transcriptPath, 'utf-8').trim().split('\n').filter(Boolean);
    const lines = all.length > MAX_SCAN_LINES ? all.slice(-MAX_SCAN_LINES) : all;
    let hasNavigate = false;
    let hasScreenshot = false;
    for (const line of lines) {
      try {
        const e = JSON.parse(line);
        const ts = e.timestamp ? Date.parse(e.timestamp) : 0;
        if (Number.isNaN(ts) || ts < sinceMs) continue;
        const content = e.message && e.message.content;
        if (!Array.isArray(content)) continue;
        for (const c of content) {
          if (!c || c.type !== 'tool_use') continue;
          const name = (c.name || '').toLowerCase();
          // Navigate to the prod URL
          if (name === 'mcp__claude_in_chrome__navigate') hasNavigate = true;
          // Screenshot = visual proof (computer action=screenshot or preview_screenshot)
          if (
            (name === 'mcp__claude_in_chrome__computer' && c.input && c.input.action === 'screenshot') ||
            name === 'mcp__claude_preview__preview_screenshot'
          ) {
            hasScreenshot = true;
          }
        }
      } catch {}
    }
    // Both required: navigated to prod AND took a screenshot. DOM inspection alone is not verification.
    return hasNavigate && hasScreenshot;
  } catch {
    return false; // unreadable transcript → don't block
  }
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
