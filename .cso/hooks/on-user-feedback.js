#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const STATE_DIR = path.join(__dirname, '../state');
const WORKFLOW_STATE = path.join(STATE_DIR, 'workflow_state.json');
const FEEDBACK_LOG = path.join(STATE_DIR, 'feedback.jsonl');

const DISSATISFACTION_PATTERNS = [
  /not happy/i,
  /not satisfied/i,
  /not good/i,
  /bad/i,
  /terrible/i,
  /awful/i,
  /hate/i,
  /wrong/i,
  /broken/i,
  /useless/i,
  /disappointing/i,
  /disappointed/i,
  /issue/i,
  /problem/i,
  /failed/i,
  /doesn't work/i,
  /won't work/i,
  /can't/i,
  /should have/i,
  /could be better/i,
  /needs work/i
];

const SATISFACTION_PATTERNS = [
  /perfect/i,
  /great/i,
  /excellent/i,
  /love/i,
  /amazing/i,
  /awesome/i,
  /good job/i,
  /well done/i,
  /exactly what/i,
  /thanks/i,
  /appreciate/i
];

async function onUserFeedback() {
  try {
    const input = await readStdin();
    if (!input || input.length < 10) return;

    // Check workflow exists
    if (!fs.existsSync(WORKFLOW_STATE)) return;
    const state = JSON.parse(fs.readFileSync(WORKFLOW_STATE, 'utf-8'));

    // Analyze sentiment
    const sentiment = analyzeSentiment(input);

    if (!sentiment.isValid) return; // Not feedback

    // Log feedback
    logFeedback(sentiment, input);

    console.log(`[CSO] Feedback detected: ${sentiment.type}`);

    // Handle dissatisfaction
    if (sentiment.type === 'dissatisfied') {
      console.log('[CSO] 🔄 Auto-rework triggered');
      console.log(`[CSO] Issues detected: ${sentiment.issues.join(', ')}`);

      // Trigger rework
      triggerRework(state, sentiment);
    }

    // Handle satisfaction
    if (sentiment.type === 'satisfied') {
      console.log('[CSO] ✅ Satisfaction confirmed');
      logIteration(state, 'satisfied');
    }
  } catch (error) {
    console.error('[CSO] Feedback error:', error.message);
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

function analyzeSentiment(text) {
  const lowerText = text.toLowerCase();

  // Check dissatisfaction
  const dissatisfactionMatches = DISSATISFACTION_PATTERNS.filter(p => p.test(lowerText));
  if (dissatisfactionMatches.length > 0) {
    return {
      isValid: true,
      type: 'dissatisfied',
      confidence: Math.min(1.0, dissatisfactionMatches.length / 3),
      issues: extractIssues(text)
    };
  }

  // Check satisfaction
  const satisfactionMatches = SATISFACTION_PATTERNS.filter(p => p.test(lowerText));
  if (satisfactionMatches.length > 0) {
    return {
      isValid: true,
      type: 'satisfied',
      confidence: satisfactionMatches.length / 2
    };
  }

  return { isValid: false };
}

function extractIssues(text) {
  const issues = [];

  // Common issue patterns
  if (/design|aesthetic|look|visual/i.test(text)) issues.push('design');
  if (/function|work|broken|fail/i.test(text)) issues.push('functionality');
  if (/missing|need|add/i.test(text)) issues.push('missing-features');
  if (/performance|slow|lag/i.test(text)) issues.push('performance');
  if (/confusing|unclear|understand/i.test(text)) issues.push('ux');
  if (/data|accuracy|wrong/i.test(text)) issues.push('data-quality');

  return issues.length > 0 ? issues : ['general'];
}

function triggerRework(state, sentiment) {
  if (!state.inProgressTask) {
    console.log('[CSO] No task in progress. Escalating to user.');
    return;
  }

  // Create rework task
  const task = state.tasks[state.inProgressTask];
  if (!task) return;

  // Determine rework owner
  let reworkOwner = 'engineer';
  if (sentiment.issues.includes('design')) reworkOwner = 'engineer';
  if (sentiment.issues.includes('functionality')) reworkOwner = task.owner || 'engineer';
  if (sentiment.issues.includes('missing-features')) reworkOwner = 'engineer';

  // Mark as rework
  task.status = 'rework';
  task.reworkReason = sentiment.issues.join(', ');
  task.reworkCount = (task.reworkCount || 0) + 1;
  task.lastReworkAt = new Date().toISOString();

  // Route back
  state.inProgressTask = state.inProgressTask; // Keep same task
  state.tasks[state.inProgressTask] = task;

  // Save state
  fs.writeFileSync(WORKFLOW_STATE, JSON.stringify(state, null, 2));

  console.log(`[CSO] → Rerouting to ${reworkOwner} for improvements`);
  console.log(`[CSO] Rework reason: ${sentiment.issues.join(', ')}`);

  // Log iteration
  logIteration(state, 'rework', sentiment.issues);
}

function logFeedback(sentiment, text) {
  if (!fs.existsSync(STATE_DIR)) {
    fs.mkdirSync(STATE_DIR, { recursive: true });
  }

  const entry = {
    timestamp: new Date().toISOString(),
    type: sentiment.type,
    confidence: sentiment.confidence,
    issues: sentiment.issues || [],
    excerpt: text.substring(0, 100)
  };

  fs.appendFileSync(FEEDBACK_LOG, JSON.stringify(entry) + '\n');
}

function logIteration(state, status, issues = []) {
  const iterationLog = path.join(STATE_DIR, 'iterations.jsonl');
  const entry = {
    timestamp: new Date().toISOString(),
    taskId: state.inProgressTask,
    status,
    issues,
    iteration: (state.tasks[state.inProgressTask]?.reworkCount || 0)
  };

  if (!fs.existsSync(STATE_DIR)) {
    fs.mkdirSync(STATE_DIR, { recursive: true });
  }

  fs.appendFileSync(iterationLog, JSON.stringify(entry) + '\n');
}

onUserFeedback().catch(err => {
  console.error('[CSO] Fatal error:', err);
  process.exit(1);
});
