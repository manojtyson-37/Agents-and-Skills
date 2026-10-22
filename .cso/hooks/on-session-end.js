#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { logHookEvent, getActiveWorkflow: resolveActiveWorkflow } = require('./cso-utils');

const STATE_DIR = path.join(__dirname, '../state');
const WORKFLOWS_DIR = path.join(STATE_DIR, 'workflows');
const METRICS_FILE = path.join(STATE_DIR, 'metrics.json');

async function onSessionEnd() {
  try {
    if (!fs.existsSync(STATE_DIR)) {
      fs.mkdirSync(STATE_DIR, { recursive: true });
    }

    // Resolve active workflow BEFORE the save loop — the loop resets file mtimes on
    // all in-progress workflows simultaneously, making post-loop mtime-based ranking
    // undefined. The shared resolver uses stable filename timestamps instead.
    const activeWf = resolveActiveWorkflow(STATE_DIR);

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
            console.log('[CSO] Workflow state saved:', s.objective?.slice(0, 60) || f);
            saveIncompleteToInbox(s);
          }
        } catch (e) {
          console.error('[CSO] Failed to save workflow:', f, e.message);
          logHookEvent('on-session-end', 'workflow-save', 'error', e.message);
        }
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
      } catch (e) {
        console.error('[CSO] Metrics read error:', e.message);
      }
    }

    // Check if learning pass was done
    checkLearningPass();

    // Auto-distill decision patterns if ledger was touched this session
    spawnDistillIfNeeded();

    // Refresh context.md snapshot (reduces token load on next session start)
    writeContextMd(activeWf);

    // Write an auto session checkpoint so the NEXT session has continuity
    writeSessionCheckpoint(activeWf);

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
    try {
      const parsed = JSON.parse(fs.readFileSync(inboxPath, 'utf-8'));
      inbox = parsed;
      inbox.tasks = Array.isArray(inbox.tasks) ? inbox.tasks : [];
    } catch (e) {
      console.error('[CSO] inbox.json parse error:', e.message);
    }
  }

  // tasks is an object keyed by task-id; values have status/owner/note
  // Use Object.entries so the key (task id / title) is preserved
  const tasksRaw = state.tasks || {};
  const taskEntries = Array.isArray(tasksRaw)
    ? tasksRaw.map(t => [t.title || t.id || '?', t])
    : Object.entries(tasksRaw);
  const incompleteTasks = taskEntries.filter(([, t]) => t.status !== 'completed');

  if (incompleteTasks.length === 0) return;

  // Replace existing entries for this workflow rather than duplicating
  const workflowId = state.objectiveId;
  if (workflowId) {
    inbox.tasks = inbox.tasks.filter(t => t.workflowId !== workflowId);
  }

  const cwd = process.cwd();
  const workspace = path.basename(cwd);
  const totalTasks = taskEntries.length;
  const completedCount = taskEntries.filter(([, t]) => t.status === 'completed').length;

  incompleteTasks.forEach(([title, task]) => {
    inbox.tasks.push({
      id: `inbox-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title,
      owner: task.owner,
      estimate: task.estimate,
      status: 'pending',
      priority: task.blockedBy?.length > 0 ? 'blocked' : 'ready',
      workspace,
      workspacePath: cwd,
      workflowId,
      workflowObjective: state.objective,
      context: `Part of workflow: ${state.objective}. ${totalTasks} total tasks, ${completedCount} completed.`,
      createdAt: new Date().toISOString()
    });
  });

  inbox.lastUpdated = new Date().toISOString();
  fs.writeFileSync(inboxPath, JSON.stringify(inbox, null, 2));
  console.log(`[CSO] Saved ${incompleteTasks.length} incomplete task(s) to inbox`);
}

function writeSessionCheckpoint(activeWf) {
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

    const obj0 = (activeWf?.objective || '').toLowerCase();
    const isRealWorkflow = activeWf &&
      (activeWf.status === 'in-progress' || activeWf.status === 'active') &&
      obj0 && obj0 !== '(idle)' && obj0 !== '(none)';

    let newDecisionSince = false;
    if (fs.existsSync(decisionsLog)) {
      const dl = fs.readFileSync(decisionsLog, 'utf-8').trim().split('\n').filter(Boolean);
      const lastD = dl.length ? JSON.parse(dl[dl.length - 1]) : null;
      if (lastD && (new Date(lastD.timestamp).getTime() || 0) > lastTs) newDecisionSince = true;
    }
    if (!isRealWorkflow && !newDecisionSince) {
      return; // nothing happened this session — no checkpoint
    }

    let objective = '(none)', status = 'idle', completed = 0, total = 0, open = [];
    if (activeWf) {
      objective = activeWf.objective || objective;
      status = activeWf.status || status;
      const tasks = activeWf.tasks || {};
      const taskEntries = Array.isArray(tasks)
        ? tasks.map(t => [t.title || t.id || '?', t])
        : Object.entries(tasks);
      completed = taskEntries.filter(([, t]) => t.status === 'completed').length;
      total = taskEntries.length;
      open = taskEntries.filter(([, t]) => t.status !== 'completed').map(([k]) => k);
    }

    // last 8 decisions for the trail
    let decisions = [];
    if (fs.existsSync(decisionsLog)) {
      decisions = fs.readFileSync(decisionsLog, 'utf-8').trim().split('\n').filter(Boolean)
        .slice(-8).map(l => { try { return JSON.parse(l).decision; } catch { return null; } }).filter(Boolean);
    }

    let openInbox = 0;
    if (fs.existsSync(inboxPath)) {
      try {
        const ib = JSON.parse(fs.readFileSync(inboxPath, 'utf-8'));
        openInbox = (Array.isArray(ib.tasks) ? ib.tasks : []).filter(t => t.status === 'pending').length;
      } catch {}
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
    const entry = {
      timestamp: new Date().toISOString(),
      decision: 'FAILURE: Session ended without learning pass',
      reason: `${corrections} corrections detected in feedback log but no Learning: entries in decisions.jsonl. Memory files may be stale.`,
      persona: 'orchestrator'
    };
    fs.appendFileSync(decisionsLog, JSON.stringify(entry) + '\n');
  }
}

function writeContextMd(activeWf) {
  try {
    const contextPath = path.join(STATE_DIR, 'context.md');
    const now = new Date().toISOString(); // full ISO — same-day sessions need time to distinguish

    let lines = [
      `# CSO Context Snapshot`,
      `<!-- Auto-rewritten by on-session-end hook at each session end. Do not edit manually. -->`,
      `<!-- Last updated: ${now} -->`,
      ``,
    ];

    if (activeWf) {
      const tasks = activeWf.tasks || {};
      const taskEntries = Array.isArray(tasks)
        ? tasks.map(t => [t.title || t.id || '?', t])
        : Object.entries(tasks);
      const done = taskEntries.filter(([, t]) => t.status === 'completed');
      const open = taskEntries.filter(([, t]) => t.status !== 'completed');
      lines.push(`## Active Workflow`);
      lines.push(`**${activeWf.objective || '(unnamed)'}**`);
      lines.push(`Status: ${activeWf.status || '?'} | Progress: ${done.length}/${taskEntries.length} tasks`);
      lines.push(``);
      done.forEach(([title]) => lines.push(`- ${title} ✅`));
      open.forEach(([title, t]) => {
        const marker = t.status === 'blocked' ? ' ⛔ BLOCKED' : t.status === 'deferred' ? ' 🔁 DEFERRED' : ' ⏳';
        lines.push(`- ${title}${marker}`);
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
