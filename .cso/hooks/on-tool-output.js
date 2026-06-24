#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const STATE_DIR = path.join(__dirname, '../state');
const WORKFLOW_STATE = path.join(STATE_DIR, 'workflow_state.json');
const DECISIONS_LOG = path.join(STATE_DIR, 'decisions.jsonl');
const METRICS_FILE = path.join(STATE_DIR, 'metrics.json');

async function onToolOutput() {
  try {
    const input = await readStdin();
    let output;

    try {
      output = JSON.parse(input);
    } catch (e) {
      output = { raw: input };
    }

    const outputStr = typeof input === 'string' ? input : JSON.stringify(output);

    // Track real token usage from this tool output
    const outputTokens = estimateTokens(outputStr);
    accumulateTokenMetrics(outputTokens);

    // Load workflow state
    if (!fs.existsSync(WORKFLOW_STATE)) {
      return;
    }

    const state = JSON.parse(fs.readFileSync(WORKFLOW_STATE, 'utf-8'));
    if (state.status !== 'in-progress' && state.status !== 'bootstrapping') return;

    // Add token metrics to active task
    if (state.inProgressTask && state.tasks[state.inProgressTask]) {
      const task = state.tasks[state.inProgressTask];
      if (!task.tokenMetrics) {
        task.tokenMetrics = { totalTokens: 0, toolCalls: 0 };
      }
      task.tokenMetrics.totalTokens += outputTokens;
      task.tokenMetrics.toolCalls += 1;
      fs.writeFileSync(WORKFLOW_STATE, JSON.stringify(state, null, 2));
    }

    // Make decision — only log meaningful ones (not routine approves)
    const decision = makeDecision(output, state);

    if (decision.action !== 'APPROVE' || decision.nextTask) {
      logDecision(decision);
    }

    if (decision.action === 'APPROVE' && decision.nextTask) {
      routeTask(decision.nextTask, state);
    }

    // Auto-detect workflow completion
    const totalTasks = Object.keys(state.tasks || {}).length;
    const completedCount = (state.completedTasks || []).length;
    if (totalTasks > 0 && completedCount >= totalTasks && state.status === 'in-progress' && !state.inProgressTask) {
      state.status = 'completed';
      state.completedAt = new Date().toISOString();
      fs.writeFileSync(WORKFLOW_STATE, JSON.stringify(state, null, 2));
    }
  } catch (error) {
    // Silently fail — don't block Claude's tool execution
  }
}

function estimateTokens(text) {
  if (!text) return 0;
  return Math.round(String(text).length / 4);
}

function accumulateTokenMetrics(outputTokens) {
  let metrics = {
    tasksCompleted: 0, totalTasksPlanned: 0,
    tokenUsage: { totalTokens: 0, toolCalls: 0, peakOutput: 0, sessionStartedAt: null },
    decisions: { approved: 0, rework: 0, escalated: 0 }
  };

  if (fs.existsSync(METRICS_FILE)) {
    try {
      metrics = JSON.parse(fs.readFileSync(METRICS_FILE, 'utf-8'));
      if (!metrics.tokenUsage) {
        metrics.tokenUsage = { totalTokens: 0, toolCalls: 0, peakOutput: 0, sessionStartedAt: null };
      }
    } catch {}
  }

  if (!metrics.tokenUsage.sessionStartedAt) {
    metrics.tokenUsage.sessionStartedAt = new Date().toISOString();
  }

  metrics.tokenUsage.totalTokens = (metrics.tokenUsage.totalTokens || 0) + outputTokens;
  metrics.tokenUsage.toolCalls = (metrics.tokenUsage.toolCalls || 0) + 1;
  metrics.tokenUsage.peakOutput = Math.max(metrics.tokenUsage.peakOutput || 0, outputTokens);

  // Burn rate: tokens per minute
  const elapsed = (Date.now() - new Date(metrics.tokenUsage.sessionStartedAt).getTime()) / 60000;
  metrics.tokenUsage.burnRate = elapsed > 0 ? Math.round(metrics.tokenUsage.totalTokens / elapsed) : 0;
  metrics.tokenUsage.avgPerCall = metrics.tokenUsage.toolCalls > 0
    ? Math.round(metrics.tokenUsage.totalTokens / metrics.tokenUsage.toolCalls) : 0;

  // Sync task counts from workflow
  if (fs.existsSync(WORKFLOW_STATE)) {
    try {
      const state = JSON.parse(fs.readFileSync(WORKFLOW_STATE, 'utf-8'));
      metrics.totalTasksPlanned = Object.keys(state.tasks || {}).length;
      metrics.tasksCompleted = (state.completedTasks || []).length;
      metrics.workflow = state.objectiveId;
    } catch {}
  }

  // Count decisions
  if (fs.existsSync(DECISIONS_LOG)) {
    try {
      const lines = fs.readFileSync(DECISIONS_LOG, 'utf-8').split('\n').filter(l => l.trim());
      metrics.decisions = { approved: 0, rework: 0, escalated: 0 };
      lines.forEach(line => {
        try {
          const d = JSON.parse(line);
          if (d.decision === 'APPROVE') metrics.decisions.approved++;
          if (d.decision === 'REWORK') metrics.decisions.rework++;
          if (d.decision === 'ESCALATE') metrics.decisions.escalated++;
        } catch {}
      });
    } catch {}
  }

  if (!fs.existsSync(STATE_DIR)) {
    fs.mkdirSync(STATE_DIR, { recursive: true });
  }
  fs.writeFileSync(METRICS_FILE, JSON.stringify(metrics, null, 2));
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

function makeDecision(output, state) {
  const outputStr = JSON.stringify(output).toLowerCase();

  // Only flag real failures — require strong signals, not just keyword mentions
  const failureSignals = ['exit code 1', 'exit code 2', 'command failed', 'fatal:', 'panic:', 'unhandled', 'segfault', 'enoent', 'permission denied'];
  const successSignals = ['complete', 'success', 'passed', '✓', '✅'];

  const hasFailure = failureSignals.some(k => outputStr.includes(k));
  const hasSuccess = successSignals.some(k => outputStr.includes(k));

  if (hasFailure && !hasSuccess) {
    return { action: 'REWORK', issues: ['Tool execution failed'], reason: 'Command/tool failure detected' };
  }

  return {
    action: 'APPROVE',
    reason: hasSuccess ? 'Success criteria met' : 'No blockers detected',
    nextTask: findNextTask(state)
  };
}

function findNextTask(state) {
  if (!state.queuedTasks || state.queuedTasks.length === 0) return null;
  return state.queuedTasks[0];
}

function routeTask(taskId, state) {
  if (state.tasks && state.tasks[taskId]) {
    state.tasks[taskId].status = 'in-progress';
    state.inProgressTask = taskId;
    state.queuedTasks = state.queuedTasks.filter(t => t !== taskId);
    fs.writeFileSync(WORKFLOW_STATE, JSON.stringify(state, null, 2));
  }
}

function logDecision(decision) {
  const entry = {
    timestamp: new Date().toISOString(),
    decision: decision.action,
    reason: decision.reason,
    nextTask: decision.nextTask || null
  };
  fs.appendFileSync(DECISIONS_LOG, JSON.stringify(entry) + '\n');
}

onToolOutput().catch(() => {});
