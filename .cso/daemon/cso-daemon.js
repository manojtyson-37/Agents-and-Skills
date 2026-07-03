#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { analyzeAndRepair } from './feedback-analyzer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STATE_DIR = path.join(__dirname, '../state');
const WORKFLOW_STATE = path.join(STATE_DIR, 'workflow_state.json');
const NOTIFICATIONS_FILE = path.join(STATE_DIR, 'notifications.jsonl');

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
  if (!fs.existsSync(WORKFLOW_STATE)) return;

  let state;
  try {
    state = JSON.parse(fs.readFileSync(WORKFLOW_STATE, 'utf-8'));
  } catch { return; }

  // Auto-detect completion: all tasks done but status still in-progress
  if (state.status === 'in-progress') {
    const totalTasks = Object.keys(state.tasks || {}).length;
    const completedCount = (state.completedTasks || []).length;
    if (totalTasks > 0 && completedCount >= totalTasks && !state.inProgressTask) {
      state.status = 'completed';
      state.completedAt = new Date().toISOString();
      fs.writeFileSync(WORKFLOW_STATE, JSON.stringify(state, null, 2));
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
    fs.writeFileSync(WORKFLOW_STATE, JSON.stringify(state, null, 2));
    console.log('[CSO Daemon] Completion notification sent');
  }

  // Compute elapsed time
  if (state.status === 'in-progress' && state.startedAt) {
    const elapsed = Date.now() - new Date(state.startedAt).getTime();
    const minutes = Math.floor(elapsed / 60000);
    const hours = Math.floor(minutes / 60);
    state.elapsedTime = hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes} minutes`;
    fs.writeFileSync(WORKFLOW_STATE, JSON.stringify(state, null, 2));
  }
}

async function monitorInboxAge() {
  const inboxPath = new URL('../state/inbox.json', import.meta.url).pathname;
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
