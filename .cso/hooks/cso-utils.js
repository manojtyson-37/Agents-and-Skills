#!/usr/bin/env node
// Shared utilities for CSO hooks. Import with require('./cso-utils').

const fs = require('fs');
const path = require('path');

/**
 * Returns true if any project memory file (excluding MEMORY.md) was modified
 * at or after sinceMs. Used by on-stop-gate.js and on-learn-check.js.
 */
function checkMemoryUpdated(sinceMs) {
  const cwd = process.cwd();
  const projectKey = cwd.replace(/[\/ ]/g, '-');
  const memoryDir = path.join(
    process.env.HOME || '/Users/manojaaa',
    '.claude/projects',
    projectKey,
    'memory'
  );
  if (!fs.existsSync(memoryDir)) return false;
  const files = fs.readdirSync(memoryDir).filter(f => f.endsWith('.md') && f !== 'MEMORY.md');
  for (const f of files) {
    if (fs.statSync(path.join(memoryDir, f)).mtimeMs >= sinceMs) return true;
  }
  return false;
}

const HOOK_EVENTS_FILE = path.join(__dirname, '../state/hook_events.jsonl');
const HOOK_EVENTS_STATE_DIR = path.join(__dirname, '../state');
const HOOK_EVENTS_MAX = 2000;
const HOOK_EVENTS_TRIM = 1000;

/**
 * Append a structured event to hook_events.jsonl.
 * Caps the file at HOOK_EVENTS_MAX lines, trimming to HOOK_EVENTS_TRIM when exceeded.
 *
 * @param {string} hookName  - e.g. "on-stop-gate"
 * @param {string} gate      - e.g. "gate-1-learning"
 * @param {string} outcome   - "passed" | "blocked" | "skipped" | "fired"
 * @param {string} [detail]  - human-readable detail string
 */
function logHookEvent(hookName, gate, outcome, detail) {
  try {
    if (!fs.existsSync(HOOK_EVENTS_STATE_DIR)) {
      fs.mkdirSync(HOOK_EVENTS_STATE_DIR, { recursive: true });
    }
    // Cap before appending
    if (fs.existsSync(HOOK_EVENTS_FILE)) {
      const raw = fs.readFileSync(HOOK_EVENTS_FILE, 'utf-8');
      const lines = raw.trim().split('\n').filter(Boolean);
      if (lines.length >= HOOK_EVENTS_MAX) {
        fs.writeFileSync(HOOK_EVENTS_FILE, lines.slice(-HOOK_EVENTS_TRIM).join('\n') + '\n');
      }
    }
    const entry = JSON.stringify({
      ts: new Date().toISOString(),
      hook: hookName,
      gate,
      outcome,
      detail: detail || ''
    });
    fs.appendFileSync(HOOK_EVENTS_FILE, entry + '\n');
  } catch {
    // Never let observability crash the session
  }
}

// ─── Workflow resolver ───────────────────────────────────────────────────────
// Single source of truth for "which workflow is active?" across all hooks,
// dashboard, and daemon. Reads from workflows/ dir — never from the deleted
// workflow_state.json flat file.

/**
 * Return all parsed workflow objects from STATE_DIR/workflows/.
 * Each object gets a non-enumerable `_filePath` so callers can write back.
 */
function getAllWorkflows(stateDir) {
  const workflowsDir = path.join(stateDir, 'workflows');
  if (!fs.existsSync(workflowsDir)) return [];
  return fs.readdirSync(workflowsDir)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      try {
        const fp = path.join(workflowsDir, f);
        const wf = JSON.parse(fs.readFileSync(fp, 'utf-8'));
        // Stable creation timestamp from filename — mtime is unreliable (save loop resets it)
        const m = f.match(/workflow-(\d+)-/);
        Object.defineProperty(wf, '_filePath', { value: fp, enumerable: false });
        Object.defineProperty(wf, '_fileTs', { value: m ? parseInt(m[1], 10) : 0, enumerable: false });
        return wf;
      } catch { return null; }
    })
    .filter(Boolean);
}

/**
 * Return the single most recently created in-progress/active workflow,
 * or the most recently created workflow of any status as a fallback.
 * Returns null if no workflows exist.
 */
function getActiveWorkflow(stateDir) {
  const all = getAllWorkflows(stateDir);
  const active = all
    .filter(wf => wf.status === 'in-progress' || wf.status === 'active')
    .sort((a, b) => (b._fileTs || 0) - (a._fileTs || 0));
  if (active.length) return active[0];
  // Strict-active fallback: return null so callers can emit "No active workflow"
  return null;
}

module.exports = { checkMemoryUpdated, logHookEvent, getAllWorkflows, getActiveWorkflow };
