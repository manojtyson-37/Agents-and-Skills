#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STATE_DIR = path.join(__dirname, '../state');

const WORKFLOW_STATE = path.join(STATE_DIR, 'workflow_state.json');
const IMPROVEMENTS = path.join(STATE_DIR, 'improvements.jsonl');

let lastCheckedWorkflow = null;

async function startMetaMonitor() {
  console.log('[CSO Meta-Monitor] Starting self-awareness...');

  setInterval(async () => {
    try {
      await analyzeCSO();
    } catch (error) {
      console.error('[Meta-Monitor] Error:', error.message);
    }
  }, 5000); // Check every 5 seconds

  console.log('[CSO Meta-Monitor] Running. Watching CSO behavior...');
}

async function analyzeCSO() {
  if (!fs.existsSync(WORKFLOW_STATE)) return;

  const state = JSON.parse(fs.readFileSync(WORKFLOW_STATE, 'utf-8'));

  // Detect gaps
  const gaps = [];

  // Gap 1: Workflow completion not notified
  if (state.status === 'completed' && !state.notificationSent) {
    gaps.push({
      severity: 'high',
      type: 'missing-notification',
      description: 'Workflow completed but no notification sent to user',
      task: 'Add completion notification system'
    });
    state.notificationSent = true;
  }

  // Gap 2: No performance metrics
  if (!fs.existsSync(path.join(STATE_DIR, 'performance.json'))) {
    gaps.push({
      severity: 'medium',
      type: 'missing-monitoring',
      description: 'No performance metrics collected',
      task: 'Implement performance tracking (duration, efficiency)'
    });
  }

  // Gap 3: No error recovery
  if (fs.existsSync(path.join(STATE_DIR, 'task_history.jsonl'))) {
    const history = fs.readFileSync(path.join(STATE_DIR, 'task_history.jsonl'), 'utf-8')
      .split('\n')
      .filter(l => l.trim())
      .map(l => JSON.parse(l));

    const errorCount = history.filter(h => h.event === 'ERROR').length;
    if (errorCount > 0) {
      gaps.push({
        severity: 'high',
        type: 'no-error-recovery',
        description: `${errorCount} errors detected with no auto-recovery`,
        task: 'Implement automatic error recovery and retry logic'
      });
    }
  }

  // Gap 4: No workflow optimization
  if (state.completedTasks && state.completedTasks.length > 3) {
    gaps.push({
      severity: 'low',
      type: 'no-optimization',
      description: 'No analysis of task execution patterns for optimization',
      task: 'Add workflow optimization analyzer'
    });
  }

  // Gap 5: No user feedback integration
  if (!fs.existsSync(path.join(STATE_DIR, 'feedback.jsonl'))) {
    gaps.push({
      severity: 'medium',
      type: 'missing-feedback-system',
      description: 'User feedback not being captured systematically',
      task: 'Enhance feedback collection and analysis'
    });
  }

  // Create improvement tasks for detected gaps
  if (gaps.length > 0) {
    for (const gap of gaps) {
      createImprovementTask(state, gap);
    }
  }

  // Save state
  fs.writeFileSync(WORKFLOW_STATE, JSON.stringify(state, null, 2));
}

function createImprovementTask(state, gap) {
  // Check if improvement already exists
  const taskId = `improvement-${gap.type}`;
  if (state.tasks[taskId]) return; // Already queued

  console.log(`[Meta-Monitor] 🔧 Detected gap: ${gap.description}`);
  console.log(`[Meta-Monitor] → Creating improvement task: ${gap.task}`);

  // Add improvement task to workflow
  state.tasks[taskId] = {
    id: taskId,
    title: gap.task,
    owner: 'orchestrator',
    status: 'queued',
    estimate: 0.02, // Fast improvement tasks
    blockedBy: [],
    startedAt: null,
    completedAt: null,
    outputId: null,
    isImprovement: true,
    gap: gap.type,
    severity: gap.severity,
    decisions: []
  };

  // Add to queue
  if (!state.queuedTasks) state.queuedTasks = [];
  state.queuedTasks.push(taskId);

  // Log improvement
  logImprovement(gap, taskId);
}

function logImprovement(gap, taskId) {
  if (!fs.existsSync(STATE_DIR)) {
    fs.mkdirSync(STATE_DIR, { recursive: true });
  }

  const entry = {
    timestamp: new Date().toISOString(),
    taskId,
    type: gap.type,
    severity: gap.severity,
    description: gap.description,
    action: 'auto-created'
  };

  fs.appendFileSync(IMPROVEMENTS, JSON.stringify(entry) + '\n');
}

// Start meta-monitor
startMetaMonitor();
