#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const STATE_DIR = path.join(__dirname, '../state');
const DECISION_DIR = path.join(__dirname, '../decision');
const WORKFLOW_STATE = path.join(STATE_DIR, 'workflow_state.json');
const FEEDBACK_LOG = path.join(STATE_DIR, 'feedback.jsonl');
const PATTERN_LOG = path.join(DECISION_DIR, 'decision_patterns.jsonl');

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

// Approval signals: user greenlighting a proposal CSO made.
// ONLY anchored ^...$  forms — unanchored substring patterns produce false positives
// on questions like "why did you do it that way?" (code-reviewer catch, fffa9de).
// Kept to unambiguous short greenlights only.
const APPROVAL_PATTERNS = [
  /^(yes|yep|yeah|yup)[\s.!]*$/i,
  /^(go ahead|go for it|do it|do that|proceed)[\s.!]*$/i,
  /^(ok|okay|sure|agreed)[\s.!]*$/i,
  /^(sounds good|looks good)[\s.!]*$/i,
  /^yes[,.]? (do|go|add|build|fix|update|wire|implement|push|deploy)\b/i,
];

// Rejection signals: user declining a proposal (anchored to avoid false positives).
const REJECTION_PATTERNS = [
  /^(no|nope|nah|not yet|not now|skip|hold off|don't|do not)[\s.!]*$/i,
  /^(stop|cancel|abort|revert|undo)[\s.!]*$/i,
];

async function onUserFeedback() {
  try {
    const raw = await readStdin();
    if (!raw || raw.length < 2) return;

    const input = extractPromptText(raw);
    if (!input || input.length < 2) return;

    // --- Decision approval/rejection capture (passive learning loop) ---
    // Detect short decisive responses — user greenlighting or rejecting a CSO proposal.
    // These are captured into decision_patterns.jsonl so decision-maker learns over time.
    const approvalMatch = APPROVAL_PATTERNS.some(p => p.test(input.trim()));
    const rejectionMatch = REJECTION_PATTERNS.some(p => p.test(input.trim()));

    if (approvalMatch || rejectionMatch) {
      captureDecisionPattern(input.trim(), approvalMatch ? 'approve' : 'reject');
    }

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

function extractPromptText(raw) {
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed.prompt === 'string') return parsed.prompt;
    if (typeof parsed.prompt === 'object' && parsed.prompt.content) return parsed.prompt.content;
    if (typeof parsed.message === 'string') return parsed.message;
    if (typeof parsed.content === 'string') return parsed.content;
    if (typeof parsed.input === 'string') return parsed.input;
    return '';
  } catch {
    return raw.trim();
  }
}

function captureDecisionPattern(userText, signal) {
  try {
    // Read workflow state for context — only use it when workflow is actively in-progress.
    // Stale/completed workflow state produces mislabeled entries (code-reviewer catch, fffa9de).
    let context = 'unknown — no active workflow';
    let workflowObjective = '';
    if (fs.existsSync(WORKFLOW_STATE)) {
      try {
        const state = JSON.parse(fs.readFileSync(WORKFLOW_STATE, 'utf-8'));
        if (state.status === 'in-progress') {
          workflowObjective = state.objective || state.objectiveId || '';
          const inProgress = state.inProgressTask && state.tasks && state.tasks[state.inProgressTask];
          if (inProgress) {
            context = `${signal} during active task: ${inProgress.description || state.inProgressTask}`;
          } else if (workflowObjective) {
            context = `${signal} during active workflow: ${workflowObjective.substring(0, 80)}`;
          }
        }
      } catch {}
    }

    const entry = {
      timestamp: new Date().toISOString(),
      context,
      workflowObjective,
      options: signal === 'approve' ? ['approve', 'reject'] : ['reject', 'approve'],
      chosen: signal,
      userText: userText.substring(0, 80),
      decidedBy: 'user',
      confidence: 'high',
      rationale: `User said "${userText.substring(0, 40)}" — clear ${signal}`,
      reversible: true,
      override: false,
      source: 'on-user-feedback-hook',
    };

    if (!fs.existsSync(DECISION_DIR)) fs.mkdirSync(DECISION_DIR, { recursive: true });
    fs.appendFileSync(PATTERN_LOG, JSON.stringify(entry) + '\n');
    // stderr only — stdout in UserPromptSubmit hooks injects into model context (code-reviewer catch, fffa9de)
    process.stderr.write(`[CSO] decision pattern captured: ${signal} (${context.substring(0, 60)})\n`);
  } catch (e) {
    // Fail silently — don't break the session over a learning-capture failure
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
