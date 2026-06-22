#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { notifyWorkflowComplete, notifyTaskComplete } from '../notifications/notifier.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STATE_DIR = path.join(__dirname, '../state');
const WORKFLOW_STATE = path.join(STATE_DIR, 'workflow_state.json');
const TASK_HISTORY = path.join(STATE_DIR, 'task_history.jsonl');
const DECISIONS_LOG = path.join(STATE_DIR, 'decisions.jsonl');

let isRunning = false;

// Task executors for each persona
const executors = {
  engineer: simulateEngineerWork,
  'test-engineer': simulateTestEngineerWork,
  'code-reviewer': simulateCodeReviewerWork,
  'release-engineer': simulateReleaseEngineerWork,
  orchestrator: simulateOrchestratorWork
};

async function startDaemon() {
  console.log('[CSO Daemon] Starting...');
  isRunning = true;

  // Main loop
  const interval = setInterval(async () => {
    try {
      await processWorkflow();
    } catch (error) {
      console.error('[CSO Daemon] Error:', error.message);
    }
  }, 3000); // Check every 3 seconds

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('[CSO Daemon] Shutting down...');
    clearInterval(interval);
    isRunning = false;
    process.exit(0);
  });

  console.log('[CSO Daemon] Running. Monitoring workflow...');
}

async function processWorkflow() {
  if (!fs.existsSync(WORKFLOW_STATE)) return;

  const state = JSON.parse(fs.readFileSync(WORKFLOW_STATE, 'utf-8'));

  // Check if workflow completed and notify
  if (state.status === 'completed' && !state.notificationSent) {
    console.log('[CSO Daemon] 🎯 Workflow completed. Sending notification...');
    try {
      await notifyWorkflowComplete(state);
      state.notificationSent = true;
      fs.writeFileSync(WORKFLOW_STATE, JSON.stringify(state, null, 2));
      console.log('[CSO Daemon] ✅ Notification sent successfully');
    } catch (error) {
      console.error('[CSO Daemon] ✗ Notification error:', error.message);
    }
    return;
  }

  // Skip if no active task
  if (!state.inProgressTask || state.status !== 'in-progress') return;

  const task = state.tasks[state.inProgressTask];
  if (!task || task.status !== 'in-progress') return;

  // Check if task started more than estimate ago - auto-complete for demo
  if (task.startedAt) {
    const elapsed = (Date.now() - new Date(task.startedAt)) / 1000 / 60; // minutes
    const estimate = (task.estimate || 0.5) * 60; // estimate in minutes

    // If elapsed > estimate, complete task
    if (elapsed > estimate) {
      console.log(`[CSO Daemon] ✅ Task ${state.inProgressTask} elapsed time reached. Completing...`);
      await completeTask(state, task);
      return;
    }

    // If elapsed > half estimate, simulate work output
    if (elapsed > estimate / 2 && !task.outputGenerated) {
      console.log(`[CSO Daemon] ⚙️  Executing: ${task.title}`);
      await executeTask(state, task);
      return;
    }
  }
}

async function executeTask(state, task) {
  const executor = executors[task.owner];
  if (!executor) {
    console.log(`[CSO Daemon] ⚠️  No executor for ${task.owner}`);
    return;
  }

  try {
    const result = await executor(task, state);

    // Track token metrics from output
    const inputTokens = estimateTokens(task.title + ' ' + (task.description || ''));
    const outputTokens = estimateTokens(result);
    const compressedTokens = Math.round(outputTokens * 0.35); // CSO compresses ~65%

    task.outputGenerated = true;
    task.tokenMetrics = { input: inputTokens, output: outputTokens, compressed: compressedTokens };

    fs.writeFileSync(WORKFLOW_STATE, JSON.stringify(state, null, 2));

    logEvent(task.id, 'WORK_OUTPUT_GENERATED', {
      executor: task.owner,
      outputLength: result.length,
      tokens: task.tokenMetrics
    });
  } catch (error) {
    console.error(`[CSO Daemon] Execution error: ${error.message}`);
  }
}

async function completeTask(state, task) {
  task.status = 'completed';
  task.completedAt = new Date().toISOString();

  // Move to completed
  state.completedTasks.push(task.id);
  state.inProgressTask = null;

  // Auto-approve
  const decision = {
    timestamp: new Date().toISOString(),
    taskId: task.id,
    decision: 'APPROVE',
    reason: `Task completed by ${task.owner}. Quality check passed.`,
    nextTask: null
  };

  // Find next unblocked task
  const nextTask = findNextTask(state, task.id);
  if (nextTask) {
    decision.nextTask = nextTask;
    console.log(`[CSO Daemon] → Auto-routing to: ${nextTask}`);
    routeTask(state, nextTask);
  } else {
    state.status = 'completed';
    console.log('[CSO Daemon] ✅ Workflow complete!');
  }

  // Log decision
  fs.appendFileSync(DECISIONS_LOG, JSON.stringify(decision) + '\n');

  // Update metrics
  updateMetrics(state);

  // Save state
  fs.writeFileSync(WORKFLOW_STATE, JSON.stringify(state, null, 2));

  // Log completion
  logEvent(task.id, 'COMPLETED', {
    duration: Math.round((new Date(task.completedAt) - new Date(task.startedAt)) / 1000 / 60) + ' min'
  });

  // Notify task complete
  notifyTaskComplete(task);

  // Notify workflow complete if all done
  if (state.status === 'completed') {
    notifyWorkflowComplete(state);
  }
}

function findNextTask(state, completedTaskId) {
  const queuedTasks = state.queuedTasks || [];

  for (const taskId of queuedTasks) {
    const task = state.tasks[taskId];
    if (!task) continue;

    // Check if blocked by completed task
    if (task.blockedBy && task.blockedBy.includes(completedTaskId)) {
      task.blockedBy = task.blockedBy.filter(t => t !== completedTaskId);
    }

    // If no blockers, ready
    if (!task.blockedBy || task.blockedBy.length === 0) {
      return taskId;
    }
  }

  return null;
}

function routeTask(state, taskId) {
  if (!state.tasks[taskId]) return;

  state.tasks[taskId].status = 'in-progress';
  state.tasks[taskId].startedAt = new Date().toISOString();
  state.inProgressTask = taskId;
  state.queuedTasks = state.queuedTasks.filter(t => t !== taskId);

  logEvent(taskId, 'ROUTED', { owner: state.tasks[taskId].owner });
}

function updateMetrics(state) {
  const metricsFile = path.join(STATE_DIR, 'metrics.json');

  // Aggregate token metrics from all tasks
  let totalInput = 0, totalOutput = 0, totalCompressed = 0;
  Object.values(state.tasks).forEach(t => {
    if (t.tokenMetrics) {
      totalInput += t.tokenMetrics.input || 0;
      totalOutput += t.tokenMetrics.output || 0;
      totalCompressed += t.tokenMetrics.compressed || 0;
    }
  });

  const saved = totalOutput - totalCompressed;
  const compressionPercent = totalOutput > 0 ? ((saved / totalOutput) * 100) : 0;

  let metrics = {
    workflow: state.objectiveId,
    totalTasksPlanned: Object.keys(state.tasks).length,
    tasksCompleted: state.completedTasks.length,
    tasksInProgress: state.inProgressTask ? 1 : 0,
    tasksQueued: (state.queuedTasks || []).length,
    totalTokens: { input: totalInput, compressed: totalCompressed, saved },
    compressionPercent,
    decisions: { approved: 0, rework: 0, escalated: 0 }
  };

  // Count decisions
  if (fs.existsSync(DECISIONS_LOG)) {
    fs.readFileSync(DECISIONS_LOG, 'utf-8')
      .split('\n')
      .filter(l => l.trim())
      .forEach(line => {
        try {
          const d = JSON.parse(line);
          if (d.decision === 'APPROVE') metrics.decisions.approved++;
          if (d.decision === 'REWORK') metrics.decisions.rework++;
          if (d.decision === 'ESCALATE') metrics.decisions.escalated++;
        } catch (e) {}
      });
  }

  fs.writeFileSync(metricsFile, JSON.stringify(metrics, null, 2));
}

function estimateTokens(text) {
  if (!text) return 0;
  return Math.round(text.length / 4);
}

// Simulators for each persona
function simulateEngineerWork(task, state) {
  console.log(`[Engineer] Working on: ${task.title}`);
  return `Engineer completed implementation of: ${task.title}`;
}

function simulateTestEngineerWork(task, state) {
  console.log(`[Test Engineer] Testing: ${task.title}`);
  return `Test Engineer validated: ${task.title} - All tests passing`;
}

function simulateCodeReviewerWork(task, state) {
  console.log(`[Code Reviewer] Reviewing: ${task.title}`);
  return `Code Reviewer approved: ${task.title} - No issues found`;
}

function simulateReleaseEngineerWork(task, state) {
  console.log(`[Release Engineer] Deploying: ${task.title}`);
  return `Release Engineer deployed: ${task.title} - Live in production`;
}

function simulateOrchestratorWork(task, state) {
  console.log(`[Orchestrator] Orchestrating: ${task.title}`);
  return `Orchestrator coordinated: ${task.title}`;
}

function logEvent(taskId, event, details = {}) {
  if (!fs.existsSync(STATE_DIR)) {
    fs.mkdirSync(STATE_DIR, { recursive: true });
  }

  const entry = {
    timestamp: new Date().toISOString(),
    taskId,
    event,
    ...details
  };

  fs.appendFileSync(TASK_HISTORY, JSON.stringify(entry) + '\n');
}

// Start daemon
startDaemon();
