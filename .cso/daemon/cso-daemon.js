#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { analyzeAndRepair } from './feedback-analyzer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STATE_DIR = path.join(__dirname, '../state');
const WORKFLOWS_DIR = path.join(STATE_DIR, 'workflows');
const NOTIFICATIONS_FILE = path.join(STATE_DIR, 'notifications.jsonl');

// Inline resolver — ESM module cannot require() the CJS cso-utils.js.
// Returns the most recently created in-progress workflow, or null.
function getActiveWorkflow() {
  if (!fs.existsSync(WORKFLOWS_DIR)) return null;
  const entries = fs.readdirSync(WORKFLOWS_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      try {
        const wf = JSON.parse(fs.readFileSync(path.join(WORKFLOWS_DIR, f), 'utf-8'));
        const m = f.match(/workflow-(\d+)-/);
        return { wf, fileTs: m ? parseInt(m[1], 10) : 0, f };
      } catch { return null; }
    })
    .filter(Boolean);
  const active = entries
    .filter(({ wf }) => wf.status === 'in-progress' || wf.status === 'active')
    .sort((a, b) => b.fileTs - a.fileTs);
  if (active.length) return { ...active[0].wf, _file: active[0].f };
  return null;
}

// Self-repair runs every 5 minutes (not every 5s tick — feedback analysis is heavier)
const REPAIR_INTERVAL_MS = 5 * 60 * 1000;
let lastRepairRun = 0;

async function startDaemon() {
  console.log('[CSO Daemon] Starting monitor...');

  const interval = setInterval(async () => {
    try {
      await monitor();
    } catch (error) {
      console.error('[CSO Daemon] Error:', error.message);
    }
  }, 5000);

  process.on('SIGINT', () => {
    clearInterval(interval);
    process.exit(0);
  });

  console.log('[CSO Daemon] Running. Monitoring workflow state + feedback patterns...');
}

async function monitor() {
  await monitorWorkflow();
  await monitorInboxAge();
  await monitorFeedback();
}

async function monitorWorkflow() {
  const resolved = getActiveWorkflow();
  if (!resolved) return;

  const filePath = resolved._file ? path.join(WORKFLOWS_DIR, resolved._file) : null;
  // Re-read to avoid write conflicts (getActiveWorkflow reads from disk, but we need a mutable copy)
  let state;
  try {
    state = filePath ? JSON.parse(fs.readFileSync(filePath, 'utf-8')) : resolved;
  } catch { return; }

  let dirty = false;

  // Auto-detect completion: all tasks done but status still in-progress
  if (state.status === 'in-progress') {
    const tasks = state.tasks || {};
    const totalTasks = Array.isArray(tasks) ? tasks.length : Object.keys(tasks).length;
    const completedCount = (state.completedTasks || []).length;
    if (totalTasks > 0 && completedCount >= totalTasks && !state.inProgressTask) {
      state.status = 'completed';
      state.completedAt = new Date().toISOString();
      dirty = true;
      console.log('[CSO Daemon] Workflow auto-completed (all tasks done)');
    }
  }

  // Send completion notification if not sent
  if (state.status === 'completed' && !state.notificationSent) {
    const notification = {
      id: `notif-complete-${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: 'workflow-complete',
      message: `Workflow complete: ${state.objective}`,
      requiresUserAck: true,
      acknowledged: false
    };
    if (!fs.existsSync(path.dirname(NOTIFICATIONS_FILE))) {
      fs.mkdirSync(path.dirname(NOTIFICATIONS_FILE), { recursive: true });
    }
    fs.appendFileSync(NOTIFICATIONS_FILE, JSON.stringify(notification) + '\n');
    state.notificationSent = true;
    dirty = true;
    console.log('[CSO Daemon] Completion notification sent');
  }

  // Compute elapsed time
  if (state.status === 'in-progress' && state.startedAt) {
    const elapsed = Date.now() - new Date(state.startedAt).getTime();
    const minutes = Math.floor(elapsed / 60000);
    const hours = Math.floor(minutes / 60);
    state.elapsedTime = hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes} minutes`;
    dirty = true;
  }

  if (dirty && filePath) {
    fs.writeFileSync(filePath, JSON.stringify(state, null, 2));
  }
}

async function monitorInboxAge() {
  const inboxPath = path.join(STATE_DIR, 'inbox.json');
  if (!fs.existsSync(inboxPath)) return;
  try {
    const inbox = JSON.parse(fs.readFileSync(inboxPath, 'utf-8'));
    const now = Date.now();
    const STALE_MS = 24 * 3600000;
    let changed = false;
    for (const t of (inbox.tasks || [])) {
      if (t.status !== 'pending' || t.priority === 'high' || t.source === 'self-repair') continue;
      const ageMs = t.createdAt ? now - new Date(t.createdAt).getTime() : 0;
      if (ageMs > STALE_MS && t.priority !== 'escalated') {
        t.priority = 'escalated';
        t.escalatedAt = new Date().toISOString();
        changed = true;
        console.log(`[CSO Daemon] Escalated stale inbox task: ${t.title || t.workflowObjective || t.id} (${Math.round(ageMs / 3600000)}h old)`);
      }
    }
    if (changed) {
      inbox.lastUpdated = new Date().toISOString();
      const tmp = inboxPath + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(inbox, null, 2));
      fs.renameSync(tmp, inboxPath);
    }
  } catch (err) {
    console.error('[CSO Daemon] Inbox age monitor error:', err.message);
  }
}

async function monitorFeedback() {
  const now = Date.now();
  if (now - lastRepairRun < REPAIR_INTERVAL_MS) return;
  lastRepairRun = now;

  try {
    const triggered = analyzeAndRepair();
    if (triggered.length > 0) {
      console.log(`[CSO Daemon] Self-repair: ${triggered.length} category(ies) queued → ${triggered.join(', ')}`);
    }
  } catch (err) {
    console.error('[CSO Daemon] Self-repair error:', err.message);
  }
}

startDaemon();
