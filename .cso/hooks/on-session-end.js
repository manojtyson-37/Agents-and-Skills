#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const STATE_DIR = path.join(__dirname, '../state');
const WORKFLOW_STATE = path.join(STATE_DIR, 'workflow_state.json');
const METRICS_FILE = path.join(STATE_DIR, 'metrics.json');

async function onSessionEnd() {
  try {
    // Ensure state directory exists
    if (!fs.existsSync(STATE_DIR)) {
      fs.mkdirSync(STATE_DIR, { recursive: true });
    }

    // Save current workflow state
    if (fs.existsSync(WORKFLOW_STATE)) {
      const state = JSON.parse(fs.readFileSync(WORKFLOW_STATE, 'utf-8'));

      // Update end time
      state.lastSavedAt = new Date().toISOString();

      // Write back
      fs.writeFileSync(WORKFLOW_STATE, JSON.stringify(state, null, 2));
      console.log('[CSO] Workflow state saved');

      // Auto-save incomplete tasks to inbox
      if (state.status === 'in-progress') {
        saveIncompleteToInbox(state);
      }

      // Log metrics
      if (fs.existsSync(METRICS_FILE)) {
        const metrics = JSON.parse(fs.readFileSync(METRICS_FILE, 'utf-8'));
        console.log(`[CSO] Session metrics:`);
        console.log(`  Tasks: ${metrics.tasksCompleted}/${metrics.totalTasksPlanned} complete`);
        const usage = metrics.tokenUsage || {};
        if (usage.totalTokens) {
          console.log(`  Tokens: ${usage.totalTokens} total, ${usage.toolCalls} tool calls`);
        }
      }
    }

    // Check if learning pass was done
    checkLearningPass();

    // Write an auto session checkpoint so the NEXT session has continuity
    writeSessionCheckpoint();

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

  const incompleteTasks = Object.values(state.tasks || {}).filter(
    t => t.status !== 'completed'
  );

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

    // Skip idle/empty sessions: don't spam "(idle)" checkpoints that bury meaningful ones.
    // Only checkpoint if there's an active workflow OR a new decision since the last checkpoint.
    let activeWorkflow = false;
    if (fs.existsSync(WORKFLOW_STATE)) {
      const s0 = JSON.parse(fs.readFileSync(WORKFLOW_STATE, 'utf-8'));
      const obj = (s0.objective || '').toLowerCase();
      activeWorkflow = (s0.status === 'in-progress' || s0.status === 'active') &&
                       obj && obj !== '(idle)' && obj !== '(none)';
    }
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
    if (fs.existsSync(WORKFLOW_STATE)) {
      const s = JSON.parse(fs.readFileSync(WORKFLOW_STATE, 'utf-8'));
      objective = s.objective || objective;
      status = s.status || status;
      completed = (s.completedTasks || []).length;
      total = Object.keys(s.tasks || {}).length;
      open = Object.entries(s.tasks || {}).filter(([, t]) => t.status !== 'completed').map(([k]) => k);
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

onSessionEnd().catch(err => {
  console.error('[CSO] Fatal error:', err);
  process.exit(1);
});
