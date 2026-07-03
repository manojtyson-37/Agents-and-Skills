/**
 * CSO Self-Repair Analyzer
 *
 * Reads feedback.jsonl for repeated dissatisfied patterns, checks if
 * already addressed in decisions.jsonl, and writes inbox repair tasks
 * when a pattern crosses the threshold without a fix logged.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_DIR = path.join(__dirname, '../state');
const FEEDBACK_LOG = path.join(STATE_DIR, 'feedback.jsonl');
const DECISIONS_LOG = path.join(STATE_DIR, 'decisions.jsonl');
const INBOX_PATH = path.join(STATE_DIR, 'inbox.json');

const REPAIR_THRESHOLD = 2;        // dissatisfied entries before triggering repair
const LOOKBACK_MS = 48 * 3600000;  // 48h window
const COOLDOWN_MS = 6 * 3600000;   // don't re-trigger same category within 6h

// Maps feedback issue categories to repair descriptions the next session can act on
const REPAIR_TEMPLATES = {
  'functionality': {
    title: 'Self-repair: functionality regression detected',
    description: 'feedback.jsonl shows repeated functionality complaints. Review recent commits, identify broken behavior, and fix.',
    hints: ['Check recent git log for commits that changed behavior', 'Run /verify to confirm current state', 'Dispatch test-engineer to validate'],
  },
  'missing-features': {
    title: 'Self-repair: missing feature pattern detected',
    description: 'Repeated complaints about missing features. CSO shipped incomplete work (Add without Edit, or feature without expected behavior).',
    hints: ['Review the Engineer Rule: every entity must be editable', 'Check if recent features have edit/delete capabilities', 'Complete the feature before marking done'],
  },
  'design': {
    title: 'Self-repair: design quality complaints',
    description: 'Repeated design dissatisfaction. Run /design-review or ui-ux-pro-max on recent UI changes.',
    hints: ['Run /design-review on recent UI changes', 'Invoke ui-ux-pro-max skill', 'Check mobile viewport (390px)'],
  },
  'process': {
    title: 'Self-repair: CSO process failure pattern',
    description: 'CSO protocol gaps detected repeatedly (skipped verify, no plan shown, chatbot responses). Review CLAUDE.md compliance.',
    hints: ['Check if /cso-learn was run last session', 'Verify code-reviewer was dispatched', 'Confirm verify gate ran before commits'],
  },
  'default': {
    title: 'Self-repair: repeated user dissatisfaction',
    description: 'Multiple dissatisfied feedback entries detected. Review what went wrong and fix proactively.',
    hints: ['Read recent feedback.jsonl entries for context', 'Run /cso-learn to extract lessons', 'Identify and fix the root cause'],
  },
};

function readJsonl(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, 'utf-8')
    .trim().split('\n').filter(Boolean)
    .map(l => { try { return JSON.parse(l); } catch { return null; } })
    .filter(Boolean);
}

function readInbox() {
  if (!fs.existsSync(INBOX_PATH)) return { tasks: [] };
  try { return JSON.parse(fs.readFileSync(INBOX_PATH, 'utf-8')); } catch { return { tasks: [] }; }
}

function writeInbox(inbox) {
  // Atomic write: temp file + rename avoids partial reads from concurrent daemon/session writes
  const tmp = INBOX_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(inbox, null, 2));
  fs.renameSync(tmp, INBOX_PATH);
}

// Returns map of issue-category → list of recent dissatisfied entries
function groupDissatisfaction(sinceMs) {
  const entries = readJsonl(FEEDBACK_LOG)
    .filter(e => e.type === 'dissatisfied' && Date.parse(e.timestamp || 0) >= sinceMs);

  const groups = {};
  for (const entry of entries) {
    const issues = Array.isArray(entry.issues) && entry.issues.length > 0
      ? entry.issues
      : ['default'];
    for (const issue of issues) {
      if (!groups[issue]) groups[issue] = [];
      groups[issue].push(entry);
    }
  }
  return groups;
}

// Check if a self-repair task for this category was already logged in decisions.jsonl recently.
// Uses structured field match (d.source + d.category) not substring search — substring would
// match 'design' inside 'designed' or 'designation', causing false-positive dedup suppression.
function alreadyAddressed(category, sinceMs) {
  const decisions = readJsonl(DECISIONS_LOG);
  return decisions.some(d => {
    const ts = Date.parse(d.timestamp || 0);
    if (ts < sinceMs) return false;
    return d.source === 'self-repair' && d.category === category;
  });
}

// Check if a repair inbox task for this category was created recently (cooldown)
function inboxTaskExists(category) {
  const inbox = readInbox();
  const cutoff = Date.now() - COOLDOWN_MS;
  return (inbox.tasks || []).some(t => {
    const ts = Date.parse(t.createdAt || 0);
    return ts >= cutoff
      && t.source === 'self-repair'
      && (t.category === category || (t.title || '').toLowerCase().includes(category));
  });
}

export function analyzeAndRepair() {
  const now = Date.now();
  const sinceMs = now - LOOKBACK_MS;
  const groups = groupDissatisfaction(sinceMs);
  const triggered = [];
  const newTasks = [];

  // Accumulate all tasks first, then write inbox once — avoids multiple read-modify-write
  // cycles that widen the race window with concurrent session-driven inbox writers.
  for (const [category, entries] of Object.entries(groups)) {
    if (entries.length < REPAIR_THRESHOLD) continue;
    if (alreadyAddressed(category, sinceMs)) continue;
    if (inboxTaskExists(category)) continue;

    const template = REPAIR_TEMPLATES[category] || REPAIR_TEMPLATES['default'];
    const excerpts = entries.slice(-3).map(e => (e.excerpt || '').substring(0, 120));

    newTasks.push({
      id: `self-repair-${category}-${Date.now()}`,
      title: template.title,
      description: template.description,
      hints: template.hints,
      category,
      source: 'self-repair',
      priority: 'high',
      status: 'pending',
      createdAt: new Date().toISOString(),
      triggerCount: entries.length,
      recentExcerpts: excerpts,
      owner: 'engineer',
    });
    triggered.push({ category, count: entries.length });
  }

  if (newTasks.length > 0) {
    // Single atomic inbox write for all new tasks this pass
    const inbox = readInbox();
    inbox.tasks = (inbox.tasks || []).concat(newTasks);
    writeInbox(inbox);

    // Log each to decisions.jsonl for cooldown + stop-gate checks
    for (const task of newTasks) {
      const decisionEntry = {
        timestamp: new Date().toISOString(),
        decision: `Self-repair triggered: ${task.category} (${task.triggerCount} dissatisfied entries in 48h)`,
        reason: `Feedback pattern threshold crossed. Task written to inbox: ${task.id}`,
        persona: 'orchestrator',
        category: task.category,
        source: 'self-repair',
      };
      fs.appendFileSync(DECISIONS_LOG, JSON.stringify(decisionEntry) + '\n');
      console.log(`[CSO Self-Repair] Triggered for category: ${task.category} (${task.triggerCount} entries) → inbox task created`);
    }
  }

  return triggered.map(t => t.category);
}
