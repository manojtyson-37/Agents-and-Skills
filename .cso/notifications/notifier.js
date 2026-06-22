#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STATE_DIR = path.join(__dirname, '../state');
const NOTIFICATIONS_FILE = path.join(STATE_DIR, 'notifications.jsonl');
const PENDING_NOTIFICATIONS = path.join(STATE_DIR, 'pending_notifications.jsonl');

export async function notifyWorkflowComplete(workflow) {
  const notification = {
    id: `notif-${Date.now()}`,
    timestamp: new Date().toISOString(),
    type: 'workflow-complete',
    workflow: {
      objective: workflow.objective,
      tasksCompleted: workflow.completedTasks?.length || 0,
      totalTasks: Object.keys(workflow.tasks || {}).length,
      duration: workflow.elapsedTime,
      status: 'completed'
    },
    message: `✅ WORKFLOW COMPLETE: ${workflow.objective}`,
    requiresUserAck: true,
    acknowledged: false
  };

  // Log notification
  logNotification(notification);

  // Print to console for user
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🎯 WORKFLOW COMPLETE');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Objective: ${notification.workflow.objective}`);
  console.log(`Tasks: ${notification.workflow.tasksCompleted}/${notification.workflow.totalTasks} completed`);
  console.log(`Duration: ${notification.workflow.duration}`);
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('\n✅ AWAITING FEEDBACK\n');

  return notification;
}

export async function notifyTaskComplete(task) {
  const notification = {
    id: `notif-${Date.now()}`,
    timestamp: new Date().toISOString(),
    type: 'task-complete',
    task: {
      id: task.id,
      title: task.title,
      owner: task.owner,
      duration: task.completedAt && task.startedAt
        ? Math.round((new Date(task.completedAt) - new Date(task.startedAt)) / 1000 / 60) + ' min'
        : 'unknown'
    },
    message: `✅ Task complete: ${task.title}`,
    requiresUserAck: false,
    acknowledged: true
  };

  logNotification(notification);
  return notification;
}

export async function notifyBlockerDetected(blocker) {
  const notification = {
    id: `notif-${Date.now()}`,
    timestamp: new Date().toISOString(),
    type: 'blocker-detected',
    blocker,
    message: `⚠️ Blocker detected: ${blocker}`,
    requiresUserAck: true,
    acknowledged: false
  };

  logNotification(notification);
  console.log(`[CSO] ⚠️  BLOCKER: ${blocker}`);
  return notification;
}

export async function notifyFeedbackNeeded(workflow) {
  const notification = {
    id: `notif-${Date.now()}`,
    timestamp: new Date().toISOString(),
    type: 'feedback-needed',
    workflow: workflow.objectiveId,
    message: 'CSO is waiting for your feedback to continue improvements',
    requiresUserAck: true,
    acknowledged: false
  };

  logNotification(notification);
  return notification;
}

export function getPendingNotifications() {
  if (!fs.existsSync(NOTIFICATIONS_FILE)) return [];

  return fs.readFileSync(NOTIFICATIONS_FILE, 'utf-8')
    .split('\n')
    .filter(l => l.trim())
    .map(l => {
      try {
        return JSON.parse(l);
      } catch (e) {
        return null;
      }
    })
    .filter(n => n && !n.acknowledged);
}

export function acknowledgeNotification(notificationId) {
  if (!fs.existsSync(NOTIFICATIONS_FILE)) return;

  const notifications = fs.readFileSync(NOTIFICATIONS_FILE, 'utf-8')
    .split('\n')
    .filter(l => l.trim())
    .map(l => {
      try {
        const n = JSON.parse(l);
        if (n.id === notificationId) {
          n.acknowledged = true;
          n.acknowledgedAt = new Date().toISOString();
        }
        return n;
      } catch (e) {
        return null;
      }
    })
    .filter(n => n);

  fs.writeFileSync(NOTIFICATIONS_FILE, notifications.map(n => JSON.stringify(n)).join('\n'));
}

function logNotification(notification) {
  if (!fs.existsSync(path.dirname(NOTIFICATIONS_FILE))) {
    fs.mkdirSync(path.dirname(NOTIFICATIONS_FILE), { recursive: true });
  }

  fs.appendFileSync(NOTIFICATIONS_FILE, JSON.stringify(notification) + '\n');
}
