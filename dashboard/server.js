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

// API: Get workflow state
app.get('/api/workflow', (req, res) => {
  try {
    const stateFile = path.join(STATE_DIR, 'workflow_state.json');
    if (fs.existsSync(stateFile)) {
      const state = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
      res.json(state);
    } else {
      res.json({ status: 'no-workflow' });
    }
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

// API: Get metrics
app.get('/api/metrics', (req, res) => {
  try {
    const metricsFile = path.join(STATE_DIR, 'metrics.json');
    if (fs.existsSync(metricsFile)) {
      const metrics = JSON.parse(fs.readFileSync(metricsFile, 'utf-8'));
      res.json(metrics);
    } else {
      res.json({
        tasksCompleted: 0,
        totalTasksPlanned: 0,
        compressionPercent: 0
      });
    }
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

app.listen(PORT, () => {
  console.log(`CSO Dashboard running: http://localhost:${PORT}`);
  console.log(`Watching: ${STATE_DIR}`);
});
