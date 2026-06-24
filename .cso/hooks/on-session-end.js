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

onSessionEnd().catch(err => {
  console.error('[CSO] Fatal error:', err);
  process.exit(1);
});
