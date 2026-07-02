#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const STATE_DIR = path.join(__dirname, '../state');
const WORKFLOW_STATE = path.join(STATE_DIR, 'workflow_state.json');

async function onUserPrompt() {
  const rawInput = await readStdin();
  // Token-efficiency fix (2026-06-30): the full protocol block is ~700+ tokens and used
  // to fire on every single prompt unconditionally — a 15-turn session repeated it 15
  // times verbatim for zero added information after the first. Now: full block once per
  // session (tracked via a marker file keyed by session_id), compact one-liner after.
  const sessionId = extractSessionId(rawInput);
  injectCSOProtocol(sessionId);
  registerWorkspace();

  try {
    if (!rawInput || rawInput.length < 5) {
      return;
    }

    // Claude Code passes JSON on stdin — extract actual prompt text
    const prompt = extractPromptText(rawInput);

    if (!prompt || prompt.length < 10) {
      return;
    }

    // Check if workflow already exists and is active
    if (fs.existsSync(WORKFLOW_STATE)) {
      const state = JSON.parse(fs.readFileSync(WORKFLOW_STATE, 'utf-8'));
      if (state.status === 'in-progress' || state.status === 'bootstrapping') {
        return;
      }
    }

    // Detect if this is a task request
    const taskKeywords = ['build', 'create', 'implement', 'write', 'fix', 'add', 'develop', 'design', 'setup', 'configure', 'refactor', 'optimize', 'debug', 'test', 'deploy', 'remove', 'update', 'change', 'migrate', 'integrate'];
    const isTask = taskKeywords.some(k => prompt.toLowerCase().includes(k));

    if (!isTask) {
      return;
    }

    // Create new workflow state
    const objectiveId = `workflow-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const now = new Date().toISOString();

    const workflow = {
      objectiveId,
      objective: prompt.substring(0, 200),
      status: 'bootstrapping',
      createdAt: now,
      startedAt: now,
      estimatedDuration: '2 hours',
      elapsedTime: '0 minutes',
      tasks: {},
      completedTasks: [],
      inProgressTask: 'task-breakdown',
      queuedTasks: [],
      blockers: [],
      nextAction: 'CSO: Breaking down objective into tasks...'
    };

    // Ensure state directory exists
    if (!fs.existsSync(STATE_DIR)) {
      fs.mkdirSync(STATE_DIR, { recursive: true });
    }

    // Save workflow state
    fs.writeFileSync(WORKFLOW_STATE, JSON.stringify(workflow, null, 2));

    // Log initialization
    logEvent('WORKFLOW_INITIALIZED', {
      objectiveId,
      objective: workflow.objective,
      taskBreakdownRequested: true
    });

    console.log('[CSO] 🚀 New workflow initialized');
    console.log(`[CSO] Objective: ${workflow.objective.substring(0, 100)}...`);
    console.log('[CSO] → Routing to task-breakdown skill');
  } catch (error) {
    console.error('[CSO] Bootstrap error:', error.message);
  }
}

function extractSessionId(raw) {
  try {
    const parsed = JSON.parse(raw);
    return parsed.session_id || null;
  } catch {
    return null;
  }
}

function extractPromptText(raw) {
  try {
    const parsed = JSON.parse(raw);
    // Claude Code hook stdin formats — try known fields
    if (typeof parsed.prompt === 'string') return parsed.prompt;
    if (typeof parsed.prompt === 'object' && parsed.prompt.content) return parsed.prompt.content;
    if (typeof parsed.message === 'string') return parsed.message;
    if (typeof parsed.content === 'string') return parsed.content;
    if (typeof parsed.input === 'string') return parsed.input;
    // If JSON but no known prompt field, skip (session metadata only)
    return '';
  } catch {
    // Not JSON — treat as raw prompt text
    return raw.trim();
  }
}

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', chunk => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
    setTimeout(() => resolve(''), 100);
  });
}

function logEvent(event, details) {
  const STATE_DIR = path.join(__dirname, '../state');
  if (!fs.existsSync(STATE_DIR)) {
    fs.mkdirSync(STATE_DIR, { recursive: true });
  }

  const entry = {
    timestamp: new Date().toISOString(),
    event,
    ...details
  };

  fs.appendFileSync(
    path.join(STATE_DIR, 'task_history.jsonl'),
    JSON.stringify(entry) + '\n'
  );
}

function shouldShowFullProtocol(sessionId) {
  if (!sessionId) return true; // no session id -> can't dedupe safely, fail toward showing it
  const markerDir = path.join(STATE_DIR, '.protocol-shown');
  // Sanitize before using as a filename — session_id format isn't contractually
  // guaranteed to be a clean UUID forever, and other hooks in this dir already prune by
  // mtime (on-stop-gate.js, on-learn-check.js precedent) so this dir shouldn't be the
  // one place that grows unbounded across months of sessions.
  const safeId = String(sessionId).replace(/[^a-zA-Z0-9-]/g, '_');
  try {
    if (!fs.existsSync(markerDir)) fs.mkdirSync(markerDir, { recursive: true });
    pruneOldMarkers(markerDir);
    const markerPath = path.join(markerDir, safeId);
    if (fs.existsSync(markerPath)) return false;
    fs.writeFileSync(markerPath, new Date().toISOString());
    return true;
  } catch {
    return true; // can't track -> safer to over-show than silently under-inform
  }
}

function pruneOldMarkers(markerDir) {
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  try {
    for (const f of fs.readdirSync(markerDir)) {
      const p = path.join(markerDir, f);
      try { if (fs.statSync(p).mtimeMs < sevenDaysAgo) fs.unlinkSync(p); } catch {}
    }
  } catch {}
}

function injectCSOProtocol(sessionId) {
  const STATE_DIR_ABS = path.resolve(STATE_DIR);

  if (shouldShowFullProtocol(sessionId)) {
    console.log('[CSO Protocol] You are CSO, the Chief of Staff Orchestrator. Do NOT respond as a chatbot.');
    console.log('[CSO Protocol] For ANY task: 1) PLAN — break into subtasks with owner/estimate/dependencies, write to workflow_state.json 2) EXECUTE — do real work, update state after each task 3) REVIEW — code-reviewer pass 4) NOTIFY — mark complete, notify user.');
    console.log(`[CSO Protocol] State dir: ${STATE_DIR_ABS} (absolute path, use from any workspace). Files: workflow_state.json, decisions.jsonl, task_history.jsonl, metrics.json, notifications.jsonl`);
    console.log('[CSO Protocol] Personas: engineer | test-engineer | code-reviewer | orchestrator | ops | release-engineer');
    console.log('[CSO Protocol] Skill routing: code-reviewer→/code-review,/security-review | engineer→/improve-codebase-architecture,/simplify,/verify | orchestrator→/cso-learn(MANDATORY before Complete),/find-skills,/grill-me | test-engineer→/verify | release-engineer→/init. Auto-invoke matching skills during EXECUTE. Use /find-skills if no skill fits.');
    console.log('[CSO Protocol] Format: "CSO: [objective]" then plan, then execute, then "CSO: Complete." with summary.');
  } else {
    // Keep the MANDATORY /cso-learn reminder even in the compact form — this exact
    // instruction was the one CLAUDE.md flagged as having zero real compliance before
    // today's Stop-hook gate; dropping it from 14 of every 15 prompts would plausibly
    // make that worse, not better. Routing table detail is fine to drop (recoverable by
    // reading CLAUDE.md), this is not.
    console.log('[CSO] protocol active (plan→execute→review→notify; personas: engineer/test-engineer/code-reviewer/orchestrator/ops/release-engineer) — /cso-learn MANDATORY before "CSO: Complete."');
  }

  // Inject workflow status + inbox once per session only — printing these on every
  // turn was ~150+ tokens of repeated context that added zero information after turn 1.
  const isFirstTurn = shouldShowFullProtocol(sessionId + '-status');

  // Workflow status: first turn shows full detail; subsequent turns show compact 1-liner
  if (fs.existsSync(WORKFLOW_STATE)) {
    try {
      const state = JSON.parse(fs.readFileSync(WORKFLOW_STATE, 'utf-8'));
      if (state.status === 'in-progress' || state.status === 'bootstrapping') {
        const completed = (state.completedTasks || []).length;
        const total = Object.keys(state.tasks || {}).length;
        // Truncate objective — scheduled-task XML blobs were printing hundreds of tokens
        const shortObj = (state.objective || '').replace(/\s+/g, ' ').substring(0, 80);
        if (isFirstTurn) {
          console.log(`[CSO] Resuming workflow: ${shortObj}${state.objective?.length > 80 ? '...' : ''}`);
          console.log(`[CSO] In-progress: ${state.inProgressTask} (${state.elapsedTime || '?'})`);
          console.log(`[CSO] Progress: ${completed}/${total} tasks done`);
          if (state.queuedTasks?.length > 0) {
            console.log(`[CSO] Next tasks: ${state.queuedTasks.join(', ')}`);
          }
        } else {
          console.log(`[CSO] Workflow active: ${shortObj}... (${completed}/${total} done)`);
        }
      }
    } catch {}
  }

  // Inbox: show on first turn OR when pending count changes (new task arrived mid-session)
  const inboxPath = path.join(STATE_DIR, 'inbox.json');
  if (fs.existsSync(inboxPath)) {
    try {
      const inbox = JSON.parse(fs.readFileSync(inboxPath, 'utf-8'));
      const pending = (inbox.tasks || []).filter(t => t.status === 'pending');
      if (pending.length > 0) {
        // Re-show if first turn OR pending count changed since last shown
        const countMarkerPath = path.join(STATE_DIR, '.protocol-shown', `${String(sessionId).replace(/[^a-zA-Z0-9-]/g, '_')}-inbox-count`);
        const lastCount = fs.existsSync(countMarkerPath) ? parseInt(fs.readFileSync(countMarkerPath, 'utf-8'), 10) : -1;
        if (isFirstTurn || lastCount !== pending.length) {
          const labels = pending.map(t => t.title || t.workflowObjective || t.owner || 'untitled');
          console.log(`[CSO Inbox] ${pending.length} pending: ${labels.slice(0, 3).join(', ')}${pending.length > 3 ? '...' : ''}`);
          console.log(`[CSO Inbox] To manage: read/write ${path.join(STATE_DIR_ABS, 'inbox.json')}. Mark tasks done after completing.`);
          try { fs.writeFileSync(countMarkerPath, String(pending.length)); } catch {}
        }
      }
    } catch {}
  }
}

function registerWorkspace() {
  const wsPath = path.join(STATE_DIR, 'workspaces.json');
  const cwd = process.cwd();
  const name = path.basename(cwd);

  let registry = { version: 1, workspaces: {}, lastUpdated: null };
  if (fs.existsSync(wsPath)) {
    try { registry = JSON.parse(fs.readFileSync(wsPath, 'utf-8')); } catch {}
  }

  const existing = registry.workspaces[cwd] || {};
  registry.workspaces[cwd] = {
    name: existing.name || name,
    path: cwd,
    lastActive: new Date().toISOString(),
    sessionCount: existing.sessionCount || 0
  };

  // Snapshot current workflow status for this workspace
  if (fs.existsSync(WORKFLOW_STATE)) {
    try {
      const state = JSON.parse(fs.readFileSync(WORKFLOW_STATE, 'utf-8'));
      registry.workspaces[cwd].currentWorkflow = {
        objective: state.objective,
        status: state.status,
        progress: `${(state.completedTasks || []).length}/${Object.keys(state.tasks || {}).length}`
      };
    } catch {}
  }

  registry.lastUpdated = new Date().toISOString();

  if (!fs.existsSync(STATE_DIR)) {
    fs.mkdirSync(STATE_DIR, { recursive: true });
  }
  fs.writeFileSync(wsPath, JSON.stringify(registry, null, 2));
}

onUserPrompt().catch(err => {
  console.error('[CSO] Fatal error:', err);
  process.exit(1);
});
