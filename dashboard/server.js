#!/usr/bin/env node

const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const STATE_DIR = path.join(__dirname, '../.cso/state');

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

function readJsonl(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf-8')
    .split('\n')
    .filter(line => line.trim())
    .map(line => { try { return JSON.parse(line); } catch { return null; } })
    .filter(Boolean);
}

// Ground truth for "what's actually done": task_history.jsonl entries get written by
// real task-start/task-complete events, unlike workflow_state.json's tasks/completedTasks
// which require the agent to remember to write them and routinely don't (see
// project_cso_reliability_gaps memory — workflow_state stayed empty for 2+ days across
// sessions that did real work).
function computeRealTaskStats() {
  const history = readJsonl(path.join(STATE_DIR, 'task_history.jsonl'));
  const tasks = new Map(); // id -> { completed: bool, lastSeen: timestamp }
  let lastActivity = null;
  for (const e of history) {
    const ts = e.timestamp || e.ts;
    if (ts && (!lastActivity || ts > lastActivity)) lastActivity = ts;

    // Only entries with a real per-task id count toward the task ratio.
    // WORKFLOW_INITIALIZED/WORKFLOW_COMPLETE events key off objectiveId (a whole
    // workflow, not one task) and must NOT share the same id-space as tasks, or a
    // workflow-init event inflates totalTasksPlanned and a workflow-complete event
    // can get miscounted as a completed "task" (code-reviewer flagged this).
    if (!e.task) continue;
    const completed = e.status === 'completed' || e.event === 'task-complete';
    const prev = tasks.get(e.task) || { completed: false };
    tasks.set(e.task, { completed: prev.completed || completed });
  }
  const totalTasksPlanned = tasks.size;
  const tasksCompleted = [...tasks.values()].filter(t => t.completed).length;
  return { totalTasksPlanned, tasksCompleted, lastActivity };
}

// API: Get workflow state
app.get('/api/workflow', (req, res) => {
  try {
    const stateFile = path.join(STATE_DIR, 'workflow_state.json');
    let state = { status: 'no-workflow' };
    if (fs.existsSync(stateFile)) {
      state = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
    }
    const real = computeRealTaskStats();
    // Flag when workflow_state.json's own bookkeeping disagrees with task_history.jsonl
    // ground truth, instead of silently presenting the (possibly fictional) state as fact.
    const declaredCompleted = (state.completedTasks || []).length;
    state.dataStale = real.totalTasksPlanned > 0 && declaredCompleted !== real.tasksCompleted;
    state.realTaskStats = real;
    res.json(state);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Get decision history
app.get('/api/decisions', (req, res) => {
  try {
    const decisionsFile = path.join(STATE_DIR, 'decisions.jsonl');
    const decisions = [];
    if (fs.existsSync(decisionsFile)) {
      fs.readFileSync(decisionsFile, 'utf-8')
        .split('\n')
        .filter(line => line.trim())
        .forEach(line => {
          try {
            decisions.push(JSON.parse(line));
          } catch (e) {}
        });
    }
    res.json(decisions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Get metrics. tasksCompleted/totalTasksPlanned are recomputed live from
// task_history.jsonl (ground truth) and overwrite whatever stale numbers are sitting in
// metrics.json — see computeRealTaskStats().
app.get('/api/metrics', (req, res) => {
  try {
    const metricsFile = path.join(STATE_DIR, 'metrics.json');
    let metrics = { compressionPercent: 0 };
    if (fs.existsSync(metricsFile)) {
      metrics = JSON.parse(fs.readFileSync(metricsFile, 'utf-8'));
    }
    const real = computeRealTaskStats();
    metrics.tasksCompleted = real.tasksCompleted;
    metrics.totalTasksPlanned = real.totalTasksPlanned;
    metrics.lastRealActivity = real.lastActivity;
    res.json(metrics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Get task history
app.get('/api/history', (req, res) => {
  try {
    const historyFile = path.join(STATE_DIR, 'task_history.jsonl');
    const history = [];
    if (fs.existsSync(historyFile)) {
      fs.readFileSync(historyFile, 'utf-8')
        .split('\n')
        .filter(line => line.trim())
        .forEach(line => {
          try {
            history.push(JSON.parse(line));
          } catch (e) {}
        });
    }
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Get notifications
app.get('/api/notifications', (req, res) => {
  try {
    const notificationsFile = path.join(STATE_DIR, 'notifications.jsonl');
    const notifications = [];
    if (fs.existsSync(notificationsFile)) {
      fs.readFileSync(notificationsFile, 'utf-8')
        .split('\n')
        .filter(line => line.trim())
        .forEach(line => {
          try {
            notifications.push(JSON.parse(line));
          } catch (e) {}
        });
    }
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Acknowledge notification
app.post('/api/notifications/:id/acknowledge', (req, res) => {
  try {
    const notificationsFile = path.join(STATE_DIR, 'notifications.jsonl');
    if (!fs.existsSync(notificationsFile)) {
      return res.status(404).json({ error: 'No notifications' });
    }

    const notificationId = req.params.id;
    const notifications = [];
    fs.readFileSync(notificationsFile, 'utf-8')
      .split('\n')
      .filter(line => line.trim())
      .forEach(line => {
        try {
          notifications.push(JSON.parse(line));
        } catch (e) {}
      });

    let found = false;
    const updated = notifications.map(n => {
      if (n.id === notificationId) {
        n.acknowledged = true;
        n.acknowledgedAt = new Date().toISOString();
        found = true;
      }
      return n;
    });

    if (found) {
      fs.writeFileSync(notificationsFile, updated.map(n => JSON.stringify(n)).join('\n'));
      res.json({ acknowledged: true });
    } else {
      res.status(404).json({ error: 'Notification not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Get archived workflows (past completed workflows)
app.get('/api/archives', (req, res) => {
  try {
    const archiveDir = path.join(STATE_DIR, 'archive');
    const archives = [];

    if (fs.existsSync(archiveDir)) {
      const files = fs.readdirSync(archiveDir).filter(f => f.startsWith('workflow_') && f.endsWith('.json'));
      for (const file of files) {
        try {
          const data = JSON.parse(fs.readFileSync(path.join(archiveDir, file), 'utf-8'));
          archives.push(data);
        } catch {}
      }
      archives.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    res.json(archives);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Get inbox tasks, with real age + staleness flag — these previously sat pending
// indefinitely with no visible signal (Silaa ERP task sat 57h+ untouched, see
// project_cso_reliability_gaps memory).
app.get('/api/inbox', (req, res) => {
  try {
    const inboxFile = path.join(STATE_DIR, 'inbox.json');
    let inbox = { version: 1, tasks: [] };
    if (fs.existsSync(inboxFile)) {
      inbox = JSON.parse(fs.readFileSync(inboxFile, 'utf-8'));
    }
    const STALE_HOURS = 24;
    inbox.tasks = (inbox.tasks || []).map(t => {
      const ageHours = t.createdAt ? (Date.now() - new Date(t.createdAt).getTime()) / 3600000 : null;
      return { ...t, ageHours: ageHours !== null ? Math.round(ageHours * 10) / 10 : null, stale: ageHours !== null && ageHours > STALE_HOURS };
    });
    inbox.staleCount = inbox.tasks.filter(t => t.stale && t.status === 'pending').length;
    res.json(inbox);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Get workspace registry
app.get('/api/workspaces', (req, res) => {
  try {
    const wsFile = path.join(STATE_DIR, 'workspaces.json');
    if (fs.existsSync(wsFile)) {
      res.json(JSON.parse(fs.readFileSync(wsFile, 'utf-8')));
    } else {
      res.json({ version: 1, workspaces: {} });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Get PR watchdog status
app.get('/api/pr-watchdog', (req, res) => {
  try {
    const prFile = path.join(STATE_DIR, 'pr-watchdog.json');
    if (fs.existsSync(prFile)) {
      res.json(JSON.parse(fs.readFileSync(prFile, 'utf-8')));
    } else {
      res.json({ lastRun: null, prs: [] });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`CSO Dashboard running: http://localhost:${PORT}`);
  console.log(`Watching: ${STATE_DIR}`);
});
