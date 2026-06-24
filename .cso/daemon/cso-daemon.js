#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STATE_DIR = path.join(__dirname, '../state');
const WORKFLOW_STATE = path.join(STATE_DIR, 'workflow_state.json');
const NOTIFICATIONS_FILE = path.join(STATE_DIR, 'notifications.jsonl');

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

  console.log('[CSO Daemon] Running. Monitoring workflow state...');
}

async function monitor() {
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

startDaemon();
