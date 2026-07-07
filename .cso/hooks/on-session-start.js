#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const net = require('net');
const { logHookEvent } = require('./cso-utils');

const STATE_DIR = path.join(__dirname, '../state');
const ARCHIVE_DIR = path.join(STATE_DIR, 'archive');
const WORKFLOW_STATE = path.join(STATE_DIR, 'workflow_state.json');
const REGISTRY_FILE = path.join(STATE_DIR, 'workflows_registry.json');
const DASHBOARD_SERVER = path.join(__dirname, '../../dashboard/server.js');
const DAEMON_SCRIPT = path.join(__dirname, '../daemon/cso-daemon.js');

async function onSessionStart() {
  try {
    if (!fs.existsSync(STATE_DIR)) {
      fs.mkdirSync(STATE_DIR, { recursive: true });
      console.log('[CSO] State directory created');
    }

    logHookEvent('on-session-start', 'session', 'fired', 'session-started');

    // Fix 3: Archive completed workflows
    await archiveCompletedWorkflow();

    // Fix 2: Auto-boot dashboard + daemon
    await ensureDashboardRunning();
    await ensureDaemonRunning();

    // Surface multi-workflow registry if it exists
    surfaceWorkflowRegistry();

    // Resume in-progress workflow (backwards-compatible single-workflow path)
    if (fs.existsSync(WORKFLOW_STATE)) {
      const state = JSON.parse(fs.readFileSync(WORKFLOW_STATE, 'utf-8'));

      if (state.status === 'in-progress' && state.inProgressTask) {
        logHookEvent('on-session-start', 'workflow', 'fired', `workflow-resumed: ${(state.objective || '').substring(0, 80)}`);
        console.log(`[CSO] Resuming workflow: ${state.objective}`);
        console.log(`[CSO] In-progress: ${state.inProgressTask} (${state.elapsedTime})`);
        console.log(`[CSO] Next tasks: ${(state.queuedTasks || []).slice(0, 2).join(', ')}`);
      } else {
        console.log('[CSO] New session. Ready for workflow.');
      }
    } else {
      console.log('[CSO] New session. Ready for first workflow.');
    }

    // Surface last session recap (continuity across sessions)
    surfaceLastSession();

    // Surface pending inbox tasks
    surfaceInbox();

    // Increment workspace session count (once per session, not per prompt)
    incrementSessionCount();
  } catch (error) {
    console.error('[CSO] Session start error:', error.message);
  }
}

function incrementSessionCount() {
  const wsPath = path.join(STATE_DIR, 'workspaces.json');
  const cwd = process.cwd();
  try {
    let registry = { version: 1, workspaces: {}, lastUpdated: null };
    if (fs.existsSync(wsPath)) {
      registry = JSON.parse(fs.readFileSync(wsPath, 'utf-8'));
    }
    if (!registry.workspaces[cwd]) {
      registry.workspaces[cwd] = { name: path.basename(cwd), path: cwd, sessionCount: 0 };
    }
    registry.workspaces[cwd].sessionCount = (registry.workspaces[cwd].sessionCount || 0) + 1;
    registry.workspaces[cwd].lastActive = new Date().toISOString();
    registry.lastUpdated = new Date().toISOString();
    fs.writeFileSync(wsPath, JSON.stringify(registry, null, 2));
  } catch {}
}

async function archiveCompletedWorkflow() {
  if (!fs.existsSync(WORKFLOW_STATE)) return;

  let state;
  try {
    state = JSON.parse(fs.readFileSync(WORKFLOW_STATE, 'utf-8'));
  } catch {
    console.log('[CSO] workflow_state.json unreadable (corrupt?). Skipping archive check.');
    return;
  }

  // Archive if completed OR stale (no real activity in 24h and stuck in-progress).
  // lastSavedAt is NOT used for this clock: on-session-end.js bumps it every single
  // session regardless of whether the content actually changed, which silently defeated
  // this check (a workflow frozen since 2026-06-28 with tasks:{} never archived because
  // its "freshness" timestamp kept getting refreshed for free). Use real task_history.jsonl
  // activity instead — same ground-truth source the dashboard now uses.
  if (state.status !== 'completed') {
    // Archive ghost bootstrapped workflows immediately — these are workflows that were
    // created by the hook but never got real tasks added (model didn't execute or session
    // ended early). They have no value and inject stale "Resuming workflow" noise into
    // every subsequent session, confusing the model into trying to resume an old objective.
    const isGhostBootstrap = state.status === 'bootstrapping' && Object.keys(state.tasks || {}).length === 0;
    if (isGhostBootstrap) {
      logHookEvent('on-session-start', 'workflow', 'fired', 'ghost-archived: bootstrapping workflow with 0 tasks');
      console.log('[CSO] Ghost bootstrapped workflow detected (no tasks ever added). Archiving...');
      state.status = 'abandoned';
      state.abandonedAt = new Date().toISOString();
    } else {
      const lastTouch = lastRealActivity() || state.startedAt;
      if (!lastTouch) return;
      const hoursSinceUpdate = (Date.now() - new Date(lastTouch).getTime()) / 3600000;
      if (hoursSinceUpdate < 24) return;
      console.log(`[CSO] Stale workflow detected (${Math.round(hoursSinceUpdate)}h since real activity). Archiving...`);
      state.status = 'abandoned';
      state.abandonedAt = new Date().toISOString();
    }
  }

  if (!fs.existsSync(ARCHIVE_DIR)) {
    fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const archiveName = `workflow_${state.objectiveId || 'unknown'}_${timestamp}.json`;
  const archivePath = path.join(ARCHIVE_DIR, archiveName);

  fs.writeFileSync(archivePath, JSON.stringify(state, null, 2));
  console.log(`[CSO] Archived completed workflow: ${archiveName}`);

  // Reset state files for new session
  fs.unlinkSync(WORKFLOW_STATE);

  const staleFiles = ['decisions.jsonl', 'task_history.jsonl', 'notifications.jsonl', 'feedback.jsonl', 'iterations.jsonl'];
  for (const file of staleFiles) {
    const filePath = path.join(STATE_DIR, file);
    if (fs.existsSync(filePath)) {
      const archiveFile = path.join(ARCHIVE_DIR, `${file.replace('.jsonl', '')}_${timestamp}.jsonl`);
      fs.renameSync(filePath, archiveFile);
    }
  }

  // Keep metrics.json but reset it
  const metricsPath = path.join(STATE_DIR, 'metrics.json');
  if (fs.existsSync(metricsPath)) {
    fs.writeFileSync(metricsPath, JSON.stringify({
      tasksCompleted: 0, totalTasksPlanned: 0, compressionPercent: 0,
      totalTokens: { input: 0, compressed: 0, saved: 0 },
      decisions: { approved: 0, rework: 0, escalated: 0 }
    }, null, 2));
  }

  console.log('[CSO] State reset for new workflow.');
}

function surfaceWorkflowRegistry() {
  if (!fs.existsSync(REGISTRY_FILE)) return;
  try {
    const registry = JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf-8'));
    const activeIds = registry.active || [];
    if (activeIds.length <= 1) return; // single workflow — normal path already handles it

    console.log(`[CSO] Active workflows: ${activeIds.length}`);
    for (const id of activeIds) {
      const w = (registry.workflows || {})[id];
      if (!w) continue;
      // Try to get richer progress from per-workflow file
      let progress = '';
      let extra = '';
      if (w.stateFile && fs.existsSync(w.stateFile)) {
        try {
          const ws = JSON.parse(fs.readFileSync(w.stateFile, 'utf-8'));
          const done = (ws.completedTasks || []).length;
          const total = Object.keys(ws.tasks || {}).length;
          if (total > 0) progress = ` ${done}/${total} done`;
          if (ws.status === 'blocked') extra = ' BLOCKED';
          else if (ws.inProgressTask) extra = ` | next: ${ws.inProgressTask}`;
        } catch {}
      }
      const label = (w.objective || id).substring(0, 70);
      const status = w.status || 'unknown';
      console.log(`[CSO]   → ${label} (${status}${progress}${extra})`);
    }
    console.log(`[CSO] To switch: node "${path.join(__dirname, '../decision/workflow-manager.cjs')}" switch <objectiveId>`);
  } catch {}
}

function lastRealActivity() {
  const historyFile = path.join(STATE_DIR, 'task_history.jsonl');
  if (!fs.existsSync(historyFile)) return null;
  try {
    const lines = fs.readFileSync(historyFile, 'utf-8').trim().split('\n').filter(Boolean);
    let latest = null;
    let latestMs = -Infinity;
    for (const line of lines) {
      try {
        const e = JSON.parse(line);
        const ts = e.timestamp || e.ts;
        const ms = ts ? Date.parse(ts) : NaN;
        if (!Number.isNaN(ms) && ms > latestMs) { latestMs = ms; latest = ts; }
      } catch {}
    }
    return latest;
  } catch {
    return null;
  }
}

function isPortInUse(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(true));
    server.once('listening', () => { server.close(); resolve(false); });
    server.listen(port, '127.0.0.1');
  });
}

function isProcessRunning(scriptName) {
  try {
    const result = execSync(`pgrep -f "${scriptName}"`, { encoding: 'utf-8', timeout: 3000 });
    return result.trim().length > 0;
  } catch {
    return false;
  }
}

async function ensureDashboardRunning() {
  const port = process.env.PORT || 3000;
  const portUsed = await isPortInUse(port);

  if (portUsed) {
    console.log(`[CSO] Dashboard already running on port ${port}`);
    return;
  }

  if (!fs.existsSync(DASHBOARD_SERVER)) {
    console.log('[CSO] Dashboard server.js not found, skipping auto-start');
    return;
  }

  const logFile = path.join(__dirname, '../../dashboard/dashboard.log');
  const out = fs.openSync(logFile, 'a');
  const err = fs.openSync(logFile, 'a');

  const child = spawn('node', [DASHBOARD_SERVER], {
    detached: true,
    stdio: ['ignore', out, err],
    env: { ...process.env, PORT: String(port) }
  });
  child.unref();

  console.log(`[CSO] Dashboard started on port ${port} (pid: ${child.pid})`);
}

async function ensureDaemonRunning() {
  if (isProcessRunning('cso-daemon.js')) {
    console.log('[CSO] Daemon already running');
    return;
  }

  if (!fs.existsSync(DAEMON_SCRIPT)) {
    console.log('[CSO] Daemon script not found, skipping auto-start');
    return;
  }

  const logFile = path.join(__dirname, '../daemon/daemon.log');
  const out = fs.openSync(logFile, 'a');
  const err = fs.openSync(logFile, 'a');

  const child = spawn('node', [DAEMON_SCRIPT], {
    detached: true,
    stdio: ['ignore', out, err],
    cwd: path.join(__dirname, '../..')
  });
  child.unref();

  console.log(`[CSO] Daemon started (pid: ${child.pid})`);
}

function surfaceLastSession() {
  const logPath = path.join(STATE_DIR, 'session_log.jsonl');
  if (!fs.existsSync(logPath)) return;
  try {
    const lines = fs.readFileSync(logPath, 'utf-8').trim().split('\n').filter(Boolean);
    if (!lines.length) return;
    const parsed = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    // Prefer the most recent RICH checkpoint; else the most recent meaningful (non-idle) entry; else the last.
    const isMeaningful = e => (e.summary && e.summary.trim()) || (e.objective && !/^\(idle\)|^\(none\)/.test(e.objective));
    const last = [...parsed].reverse().find(e => e.kind === 'rich')
              || [...parsed].reverse().find(isMeaningful)
              || parsed[parsed.length - 1];
    const when = last.timestamp ? new Date(last.timestamp).toISOString().slice(0, 16).replace('T', ' ') : '?';
    console.log(`[CSO] Last session (${when}): ${last.summary || last.objective || '(no summary)'}`);
    if (last.progress) console.log(`[CSO]   Progress: ${last.progress}${last.openTasks?.length ? ' | open: ' + last.openTasks.join(', ') : ''}`);
    if (last.openThreads?.length) console.log(`[CSO]   Open threads: ${last.openThreads.join(' | ')}`);
    if (last.nextActions?.length) console.log(`[CSO]   Next: ${last.nextActions.join(' | ')}`);
    if (last.recentDecisions?.length) console.log(`[CSO]   Recent: ${last.recentDecisions.slice(-3).join(' · ')}`);
    console.log(`[CSO]   Full history: ${path.resolve(logPath)} · claude-mem has deep recall.`);
  } catch {}
}

function surfaceInbox() {
  const inboxPath = path.join(STATE_DIR, 'inbox.json');
  if (!fs.existsSync(inboxPath)) return;

  try {
    const inbox = JSON.parse(fs.readFileSync(inboxPath, 'utf-8'));
    const pending = (inbox.tasks || []).filter(t => t.status === 'pending');
    if (pending.length === 0) return;

    // Group by workflowId: a single workflow's task breakdown (e.g. 5 subtasks owned by
    // engineer/code-reviewer/release-engineer) all share workflowObjective text and used
    // to print as 5 apparently-identical lines — looked like unreviewed duplicate data,
    // wasn't. Real fix is showing it as what it is: one workflow, N subtasks, who owns
    // each — not deleting/merging the underlying distinct subtask records.
    // Group ONLY by workflowId (falling back to per-task id, never to free-text fields)
    // — code-reviewer caught that grouping by title/workflowObjective could silently
    // merge two genuinely unrelated tasks that happen to share display text, dropping
    // one from view entirely. title/workflowObjective are for display only, never identity.
    const groups = new Map();
    for (const t of pending) {
      const key = t.workflowId || t.id;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(t);
    }

    // Self-repair tasks surface first and prominently — they represent CSO detecting
    // its own failures and queueing a fix. Treat as highest priority.
    const repairTasks = pending.filter(t => t.source === 'self-repair');
    if (repairTasks.length > 0) {
      console.log(`[CSO Self-Repair] ⚠️  ${repairTasks.length} auto-detected issue(s) queued for repair:`);
      for (const t of repairTasks) {
        console.log(`[CSO Self-Repair]   → ${t.title}`);
        console.log(`[CSO Self-Repair]     ${t.description}`);
        if (t.hints?.length) console.log(`[CSO Self-Repair]     Hints: ${t.hints.slice(0, 2).join(' | ')}`);
      }
    }

    const nonRepair = pending.filter(t => t.source !== 'self-repair');
    if (nonRepair.length === 0 && repairTasks.length > 0) return;

    // Auto-promote: find the oldest "ready" task group (not blocked, not self-repair).
    // Tasks >24h old with no action are stale — surface as ACTION REQUIRED so the model
    // treats it as the session objective rather than background noise in a list.
    const STALE_MS = 24 * 3600000;
    const now = Date.now();
    let promoted = null;
    let promotedAge = 0;

    for (const tasks of groups.values()) {
      const t = tasks[0];
      if (t.source === 'self-repair') continue;
      if (t.priority === 'blocked') continue;
      const ageMs = t.createdAt ? now - new Date(t.createdAt).getTime() : 0;
      if (ageMs > STALE_MS && ageMs > promotedAge) {
        promoted = tasks;
        promotedAge = ageMs;
      }
    }

    if (promoted) {
      const t = promoted[0];
      const ageH = Math.round(promotedAge / 3600000);
      const label = t.workflowObjective || t.title || t.context || 'untitled';
      const owners = [...new Set(promoted.map(x => x.owner).filter(Boolean))];
      console.log(`[CSO] ACTION REQUIRED — inbox task stale ${ageH}h with no action:`);
      console.log(`[CSO]   Objective: ${label}`);
      console.log(`[CSO]   Owners: ${owners.join(', ')} | ${promoted.length} subtask(s)`);
      console.log(`[CSO]   Start this NOW as the session objective. Plan → Execute → Complete.`);
    }

    console.log(`[CSO Inbox] ${nonRepair.length} pending task(s) in ${groups.size} workflow(s):`);
    let i = 0;
    for (const tasks of groups.values()) {
      const t = tasks[0];
      if (t.source === 'self-repair') continue;
      i++;
      const age = t.createdAt ? Math.round((Date.now() - new Date(t.createdAt).getTime()) / 3600000) + 'h ago' : '';
      const label = t.title || t.workflowObjective || t.context || t.owner || 'untitled';
      const owners = [...new Set(tasks.map(x => x.owner).filter(Boolean))];
      const ownerStr = tasks.length > 1 ? ` (${tasks.length} subtasks: ${owners.join(', ')})` : '';
      const staleFlag = t.createdAt && (now - new Date(t.createdAt).getTime()) > STALE_MS ? ' ⚠️ STALE' : '';
      console.log(`[CSO Inbox] ${i}. ${label}${ownerStr} [${t.priority || ''}] ${age}${staleFlag}`);
    }
  } catch {}
}

onSessionStart().catch(err => {
  console.error('[CSO] Fatal error:', err);
  process.exit(1);
});
