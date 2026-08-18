#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { logHookEvent } = require('./cso-utils');

const STATE_DIR = path.join(__dirname, '../state');
const WORKFLOWS_DIR = path.join(STATE_DIR, 'workflows');
const METRICS_FILE = path.join(STATE_DIR, 'metrics.json');

// Returns the most recently active workflow from workflows/ dir, or null.
function getActiveWorkflow() {
  if (!fs.existsSync(WORKFLOWS_DIR)) return null;
  const files = fs.readdirSync(WORKFLOWS_DIR).filter(f => f.endsWith('.json'));
  let best = null, bestMtime = 0;
  for (const f of files) {
    const fp = path.join(WORKFLOWS_DIR, f);
    try {
      const s = JSON.parse(fs.readFileSync(fp, 'utf-8'));
      const mtime = fs.statSync(fp).mtimeMs;
      if (s.status === 'in-progress' || s.status === 'active') {
        if (mtime > bestMtime) { best = s; bestMtime = mtime; }
      }
    } catch {}
  }
  // Fallback: most recently modified workflow of any status
  if (!best) {
    for (const f of files) {
      const fp = path.join(WORKFLOWS_DIR, f);
      try {
        const mtime = fs.statSync(fp).mtimeMs;
        if (mtime > bestMtime) { best = JSON.parse(fs.readFileSync(fp, 'utf-8')); bestMtime = mtime; }
      } catch {}
    }
  }
  return best;
}

async function onSessionEnd() {
  try {
    if (!fs.existsSync(STATE_DIR)) {
      fs.mkdirSync(STATE_DIR, { recursive: true });
    }

    // Save all in-progress workflows (touch lastSavedAt)
    if (fs.existsSync(WORKFLOWS_DIR)) {
      const files = fs.readdirSync(WORKFLOWS_DIR).filter(f => f.endsWith('.json'));
      for (const f of files) {
        const fp = path.join(WORKFLOWS_DIR, f);
        try {
          const s = JSON.parse(fs.readFileSync(fp, 'utf-8'));
          if (s.status === 'in-progress' || s.status === 'active') {
            s.lastSavedAt = new Date().toISOString();
            fs.writeFileSync(fp, JSON.stringify(s, null, 2));
            console.log('[CSO] Workflow state saved:', s.name || f);
            saveIncompleteToInbox(s);
          }
        } catch {}
      }
    }

    // Log metrics
    if (fs.existsSync(METRICS_FILE)) {
      try {
        const metrics = JSON.parse(fs.readFileSync(METRICS_FILE, 'utf-8'));
        console.log('[CSO] Session metrics:');
        console.log(`  Tasks: ${metrics.tasksCompleted}/${metrics.totalTasksPlanned} complete`);
        const usage = metrics.tokenUsage || {};
        if (usage.totalTokens) {
          console.log(`  Tokens: ${usage.totalTokens} total, ${usage.toolCalls} tool calls`);
        }
      } catch {}
    }

    // Check if learning pass was done
    checkLearningPass();

    // Auto-distill decision patterns if ledger was touched this session
    spawnDistillIfNeeded();

    // Refresh context.md snapshot (reduces token load on next session start)
    writeContextMd();

    // Write an auto session checkpoint so the NEXT session has continuity
    writeSessionCheckpoint();

    logHookEvent('on-session-end', 'session', 'fired', 'session-ended');
    console.log('[CSO] Session end. State persisted.');
  } catch (error) {
    console.error('[CSO] Session end error:', error.message);
  }
}

function saveIncompleteToInbox(state) {
  const inboxPath = path.join(STATE_DIR, 'inbox.json');
  let inbox = { version: 1, tasks: [], lastUpdated: null };

  if (fs.existsSync(inboxPath)) {
    try { inbox = JSON.parse(fs.readFileSync(inboxPath, 'utf-8')); } catch {}
  }

  const tasksRaw = state.tasks || {};
  const taskArr = Array.isArray(tasksRaw) ? tasksRaw : Object.values(tasksRaw);
  const incompleteTasks = taskArr.filter(t => t.status !== 'completed');

  if (incompleteTasks.length === 0) return;

  // Check if this workflow already has inbox entries — update rather than duplicate
  const existingIds = new Set(inbox.tasks.map(t => t.workflowId));
  if (existingIds.has(state.objectiveId)) {
    inbox.tasks = inbox.tasks.filter(t => t.workflowId !== state.objectiveId);
  }

  const cwd = process.cwd();
  const workspace = path.basename(cwd);

  incompleteTasks.forEach(task => {
    inbox.tasks.push({
      id: `inbox-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: task.title,
      owner: task.owner,
      estimate: task.estimate,
      status: 'pending',
      priority: task.blockedBy?.length > 0 ? 'blocked' : 'ready',
      workspace,
      workspacePath: cwd,
      workflowId: state.objectiveId,
      workflowObjective: state.objective,
      context: `Part of workflow: ${state.objective}. ${Object.keys(state.tasks).length} total tasks, ${(state.completedTasks || []).length} completed.`,
      createdAt: new Date().toISOString()
    });
  });

  inbox.lastUpdated = new Date().toISOString();
  fs.writeFileSync(inboxPath, JSON.stringify(inbox, null, 2));
  console.log(`[CSO] Saved ${incompleteTasks.length} incomplete task(s) to inbox`);
}

function writeSessionCheckpoint() {
  // Deterministic auto-summary appended every session so the next one resumes with context.
  // A richer narrative checkpoint may already have been written by CSO at "Complete" (kind:"rich").
  try {
    const logPath = path.join(STATE_DIR, 'session_log.jsonl');
    const decisionsLog = path.join(STATE_DIR, 'decisions.jsonl');
    const inboxPath = path.join(STATE_DIR, 'inbox.json');

    let lastTs = 0;
    // Skip auto if a rich checkpoint was written in the last 10 min (CSO already summarized).
    if (fs.existsSync(logPath)) {
      const lines = fs.readFileSync(logPath, 'utf-8').trim().split('\n').filter(Boolean);
      const last = lines.length ? JSON.parse(lines[lines.length - 1]) : null;
      if (last) {
        lastTs = new Date(last.timestamp).getTime() || 0;
        if (last.kind === 'rich' && (Date.now() - lastTs) < 10 * 60 * 1000) return;
      }
    }

    // Skip idle/empty sessions: don't spam checkpoints that bury meaningful ones.
    const activeWf = getActiveWorkflow();
    const obj0 = (activeWf?.objective || activeWf?.name || '').toLowerCase();
    const activeWorkflow = activeWf &&
      (activeWf.status === 'in-progress' || activeWf.status === 'active') &&
      obj0 && obj0 !== '(idle)' && obj0 !== '(none)';

    let newDecisionSince = false;
    if (fs.existsSync(decisionsLog)) {
      const dl = fs.readFileSync(decisionsLog, 'utf-8').trim().split('\n').filter(Boolean);
      const lastD = dl.length ? JSON.parse(dl[dl.length - 1]) : null;
      if (lastD && (new Date(lastD.timestamp).getTime() || 0) > lastTs) newDecisionSince = true;
    }
    if (!activeWorkflow && !newDecisionSince) {
      return; // nothing happened this session — no checkpoint
    }

    let objective = '(none)', status = 'idle', completed = 0, total = 0, open = [];
    if (activeWf) {
      const s = activeWf;
      objective = s.objective || s.name || objective;
      status = s.status || status;
      const tasks = s.tasks || {};
      const taskEntries2 = Array.isArray(tasks)
        ? tasks.map(t => [t.title || t.id || '?', t])
        : Object.entries(tasks);
      completed = taskEntries2.filter(([, t]) => t.status === 'completed').length;
      total = taskEntries2.length;
      open = taskEntries2.filter(([, t]) => t.status !== 'completed').map(([k]) => k);
    }

    // last 8 decisions for the trail
    let decisions = [];
    if (fs.existsSync(decisionsLog)) {
      decisions = fs.readFileSync(decisionsLog, 'utf-8').trim().split('\n').filter(Boolean)
        .slice(-8).map(l => { try { return JSON.parse(l).decision; } catch { return null; } }).filter(Boolean);
    }

    let openInbox = 0;
    if (fs.existsSync(inboxPath)) {
      try { openInbox = (JSON.parse(fs.readFileSync(inboxPath, 'utf-8')).tasks || []).filter(t => t.status === 'pending').length; } catch {}
    }

    const entry = {
      kind: 'auto',
      timestamp: new Date().toISOString(),
      objective, status,
      progress: `${completed}/${total}`,
      openTasks: open,
      openInbox,
      recentDecisions: decisions,
    };
    fs.appendFileSync(logPath, JSON.stringify(entry) + '\n');
    console.log('[CSO] Session checkpoint written -> session_log.jsonl');
  } catch (e) {
    console.error('[CSO] checkpoint error:', e.message);
  }
}

function spawnDistillIfNeeded() {
  try {
    // Watch decision_patterns.jsonl (written by record-decision.cjs) — this is the
    // correct trigger for distillation. decisions.jsonl is CSO's internal log (APPROVE/
    // REWORK entries), not user decision patterns. record-decision.cjs already fires
    // distill every 10 records; this is the session-end catch-all for any remainder.
    const ledger = path.join(__dirname, '../decision/decision_patterns.jsonl');
    if (!fs.existsSync(ledger)) return;
    const mtime = fs.statSync(ledger).mtimeMs;
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
    if (mtime < twoHoursAgo) return; // not touched this session (known 2h limitation)
    const { spawn } = require('child_process');
    const distillScript = path.join(__dirname, '../decision/distill-patterns.cjs');
    const child = spawn(process.execPath, [distillScript], {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
    console.log('[CSO] Distill patterns spawned in background.');
  } catch (e) {
    console.error('[CSO] spawnDistillIfNeeded error:', e.message);
  }
}

function checkLearningPass() {
  const feedbackLog = path.join(STATE_DIR, 'feedback.jsonl');
  const decisionsLog = path.join(STATE_DIR, 'decisions.jsonl');

  // Count recent corrections
  const twoHoursAgoMs = Date.now() - 2 * 60 * 60 * 1000;
  let corrections = 0;
  if (fs.existsSync(feedbackLog)) {
    const lines = fs.readFileSync(feedbackLog, 'utf-8').trim().split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        if (entry.type === 'dissatisfied' && Date.parse(entry.timestamp) > twoHoursAgoMs) corrections++;
      } catch {}
    }
  }

  // Check if learning entries were logged
  let learnings = 0;
  if (fs.existsSync(decisionsLog)) {
    const lines = fs.readFileSync(decisionsLog, 'utf-8').trim().split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        if (entry.decision && entry.decision.startsWith('Learning:') && Date.parse(entry.timestamp) > twoHoursAgoMs) learnings++;
      } catch {}
    }
  }

  if (corrections > 0 && learnings === 0) {
    logHookEvent('on-session-end', 'learning', 'fired', `learning-missing: ${corrections} correction(s) with no learning entries`);
    console.log(`[CSO] ⚠️ SESSION ENDED WITHOUT LEARNING PASS: ${corrections} correction(s) detected but no learnings saved.`);
    // Auto-log the failure
    const entry = {
      timestamp: new Date().toISOString(),
      decision: 'FAILURE: Session ended without learning pass',
      reason: `${corrections} corrections detected in feedback log but no Learning: entries in decisions.jsonl. Memory files may be stale.`,
      persona: 'orchestrator'
    };
    fs.appendFileSync(decisionsLog, JSON.stringify(entry) + '\n');
  }
}

function writeContextMd() {
  try {
    const contextPath = path.join(STATE_DIR, 'context.md');
    const wf = getActiveWorkflow();
    const now = new Date().toISOString().slice(0, 10);

    let lines = [
      `# CSO Context Snapshot`,
      `<!-- Auto-rewritten by on-session-end hook at each session end. Do not edit manually. -->`,
      `<!-- Last updated: ${now} -->`,
      ``,
    ];

    if (wf) {
      const tasks = wf.tasks || {};
      // tasks can be: array of {title,...} OR object keyed by title
      const taskEntries = Array.isArray(tasks)
        ? tasks.map(t => [t.title || t.id || '?', t])
        : Object.entries(tasks);
      const done = taskEntries.filter(([, t]) => t.status === 'completed');
      const open = taskEntries.filter(([, t]) => t.status !== 'completed');
      lines.push(`## Active Workflow`);
      lines.push(`**${wf.name || wf.objective || '(unnamed)'}**`);
      lines.push(`Status: ${wf.status || '?'} | Progress: ${done.length}/${taskEntries.length} tasks`);
      lines.push(``);
      done.forEach(([title]) => lines.push(`- ${title} ✅`));
      open.forEach(([title, t]) => {
        const blocked = t.status === 'blocked' ? ' ⛔ BLOCKED' : ' ⏳';
        lines.push(`- ${title}${blocked}`);
      });
      lines.push(``);
    } else {
      lines.push(`## Active Workflow`);
      lines.push(`No active workflow.`);
      lines.push(``);
    }

    // Last 3 decisions
    const decisionsLog = path.join(STATE_DIR, 'decisions.jsonl');
    if (fs.existsSync(decisionsLog)) {
      const dl = fs.readFileSync(decisionsLog, 'utf-8').trim().split('\n').filter(Boolean).slice(-3);
      if (dl.length) {
        lines.push(`## Recent Decisions`);
        dl.forEach(l => {
          try { const d = JSON.parse(l); lines.push(`- ${d.decision || d.chosen || '?'}`); } catch {}
        });
        lines.push(``);
      }
    }

    fs.writeFileSync(contextPath, lines.join('\n'));
    console.log('[CSO] context.md refreshed');
  } catch (e) {
    console.error('[CSO] writeContextMd error:', e.message);
  }
}

onSessionEnd().catch(err => {
  console.error('[CSO] Fatal error:', err);
  process.exit(1);
});
