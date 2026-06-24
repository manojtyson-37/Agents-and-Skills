#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const STATE_DIR = path.join(__dirname, '../state');
const WORKFLOW_STATE = path.join(STATE_DIR, 'workflow_state.json');
const TASK_HISTORY = path.join(STATE_DIR, 'task_history.jsonl');

async function onTaskComplete() {
  try {
    // Read task ID from stdin or environment
    const input = await readStdin();
    const taskId = input.trim() || process.env.TASK_ID;

    if (!taskId) {
      console.log('[CSO] No task ID provided');
      return;
    }

    console.log(`[CSO] Task complete: ${taskId}`);

    // Ensure state directory exists
    if (!fs.existsSync(STATE_DIR)) {
      fs.mkdirSync(STATE_DIR, { recursive: true });
    }

    // Load workflow state
    if (!fs.existsSync(WORKFLOW_STATE)) {
      console.log('[CSO] No active workflow');
      return;
    }

    const state = JSON.parse(fs.readFileSync(WORKFLOW_STATE, 'utf-8'));

    // Update task status
    if (state.tasks && state.tasks[taskId]) {
      state.tasks[taskId].status = 'completed';
      state.tasks[taskId].completedAt = new Date().toISOString();

      // Move from inProgress to completed
      state.completedTasks.push(taskId);
      if (state.inProgressTask === taskId) {
        state.inProgressTask = null;
      }

      // Log to history
      logTaskEvent(taskId, 'COMPLETED');

      // Find next tasks that are unblocked
      const nextTasks = findUnblockedTasks(state, taskId);

      if (nextTasks.length > 0) {
        console.log(`[CSO] Found ${nextTasks.length} unblocked task(s)`);
        for (const next of nextTasks) {
          console.log(`[CSO] → Auto-routing: ${next}`);
          routeTask(next, state);
        }
      }

      // Save updated state
      fs.writeFileSync(WORKFLOW_STATE, JSON.stringify(state, null, 2));
      console.log('[CSO] Workflow state updated');

      // Check if workflow complete — compare completed to total tasks
      const totalTasks = Object.keys(state.tasks || {}).length;
      if (state.completedTasks.length >= totalTasks && totalTasks > 0) {
        console.log('[CSO] ✅ Workflow complete!');
        state.status = 'completed';
        state.completedAt = new Date().toISOString();
        fs.writeFileSync(WORKFLOW_STATE, JSON.stringify(state, null, 2));
      }
    }
  } catch (error) {
    console.error('[CSO] Task complete error:', error.message);
  }
}

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', chunk => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
    setTimeout(() => resolve(''), 50);
  });
}

function findUnblockedTasks(state, completedTaskId) {
  const unblocked = [];

  if (!state.tasks || !state.queuedTasks) {
    return unblocked;
  }

  for (const taskId of state.queuedTasks) {
    const task = state.tasks[taskId];
    if (!task) continue;

    // Check if task was blocked by completed task
    if (task.blockedBy && task.blockedBy.includes(completedTaskId)) {
      // Remove blocker
      task.blockedBy = task.blockedBy.filter(t => t !== completedTaskId);

      if (task.blockedBy.length === 0) {
        unblocked.push(taskId);
      }
    } else if (!task.blockedBy || task.blockedBy.length === 0) {
      unblocked.push(taskId);
    }
  }

  return unblocked.slice(0, 1); // Route one at a time
}

function routeTask(taskId, state) {
  if (state.tasks && state.tasks[taskId]) {
    state.tasks[taskId].status = 'in-progress';
    state.tasks[taskId].startedAt = new Date().toISOString();
    state.inProgressTask = taskId;
    state.queuedTasks = state.queuedTasks.filter(t => t !== taskId);

    logTaskEvent(taskId, 'STARTED');
  }
}

function logTaskEvent(taskId, event) {
  const entry = {
    timestamp: new Date().toISOString(),
    taskId,
    event
  };

  if (!fs.existsSync(STATE_DIR)) {
    fs.mkdirSync(STATE_DIR, { recursive: true });
  }

  fs.appendFileSync(TASK_HISTORY, JSON.stringify(entry) + '\n');
}

onTaskComplete().catch(err => {
  console.error('[CSO] Fatal error:', err);
  process.exit(1);
});
