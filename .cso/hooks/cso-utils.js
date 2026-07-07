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

module.exports = { checkMemoryUpdated, logHookEvent };
