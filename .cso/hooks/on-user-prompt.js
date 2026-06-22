#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const STATE_DIR = path.join(__dirname, '../state');
const WORKFLOW_STATE = path.join(STATE_DIR, 'workflow_state.json');

async function onUserPrompt() {
  try {
    const rawInput = await readStdin();

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

onUserPrompt().catch(err => {
  console.error('[CSO] Fatal error:', err);
  process.exit(1);
});
