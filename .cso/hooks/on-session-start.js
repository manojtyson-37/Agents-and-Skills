#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const net = require('net');

const STATE_DIR = path.join(__dirname, '../state');
const ARCHIVE_DIR = path.join(STATE_DIR, 'archive');
const WORKFLOW_STATE = path.join(STATE_DIR, 'workflow_state.json');
const DASHBOARD_SERVER = path.join(__dirname, '../../dashboard/server.js');
const DAEMON_SCRIPT = path.join(__dirname, '../daemon/cso-daemon.js');

async function onSessionStart() {
  try {
    if (!fs.existsSync(STATE_DIR)) {
      fs.mkdirSync(STATE_DIR, { recursive: true });
      console.log('[CSO] State directory created');
    }

    // Fix 3: Archive completed workflows
    await archiveCompletedWorkflow();

    // Fix 2: Auto-boot dashboard + daemon
    await ensureDashboardRunning();
    await ensureDaemonRunning();

    // Resume in-progress workflow
    if (fs.existsSync(WORKFLOW_STATE)) {
      const state = JSON.parse(fs.readFileSync(WORKFLOW_STATE, 'utf-8'));

      if (state.status === 'in-progress' && state.inProgressTask) {
        console.log(`[CSO] Resuming workflow: ${state.objective}`);
        console.log(`[CSO] In-progress: ${state.inProgressTask} (${state.elapsedTime})`);
        console.log(`[CSO] Next tasks: ${(state.queuedTasks || []).slice(0, 2).join(', ')}`);
      } else {
        console.log('[CSO] New session. Ready for workflow.');
      }
    } else {
      console.log('[CSO] New session. Ready for first workflow.');
    }
  } catch (error) {
    console.error('[CSO] Session start error:', error.message);
  }
}

async function archiveCompletedWorkflow() {
  if (!fs.existsSync(WORKFLOW_STATE)) return;

  const state = JSON.parse(fs.readFileSync(WORKFLOW_STATE, 'utf-8'));
  if (state.status !== 'completed') return;

  if (!fs.existsSync(ARCHIVE_DIR)) {
    fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const archiveName = `workflow_${state.objectiveId || 'unknown'}_${timestamp}.json`;
  const archivePath = path.join(ARCHIVE_DIR, archiveName);

  fs.writeFileSync(archivePath, JSON.stringify(state, null, 2));
  console.log(`[CSO] Archived completed workflow: ${archiveName}`);

  // Reset state files for new session
  fs.unlinkSync(WORKFLOW_STATE);

  const staleFiles = ['decisions.jsonl', 'task_history.jsonl', 'notifications.jsonl', 'feedback.jsonl', 'iterations.jsonl'];
  for (const file of staleFiles) {
    const filePath = path.join(STATE_DIR, file);
    if (fs.existsSync(filePath)) {
      const archiveFile = path.join(ARCHIVE_DIR, `${file.replace('.jsonl', '')}_${timestamp}.jsonl`);
      fs.renameSync(filePath, archiveFile);
    }
  }

  // Keep metrics.json but reset it
  const metricsPath = path.join(STATE_DIR, 'metrics.json');
  if (fs.existsSync(metricsPath)) {
    fs.writeFileSync(metricsPath, JSON.stringify({
      tasksCompleted: 0, totalTasksPlanned: 0, compressionPercent: 0,
      totalTokens: { input: 0, compressed: 0, saved: 0 },
      decisions: { approved: 0, rework: 0, escalated: 0 }
    }, null, 2));
  }

  console.log('[CSO] State reset for new workflow.');
}

function isPortInUse(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(true));
    server.once('listening', () => { server.close(); resolve(false); });
    server.listen(port, '127.0.0.1');
  });
}

function isProcessRunning(scriptName) {
  try {
    const result = execSync(`pgrep -f "${scriptName}"`, { encoding: 'utf-8', timeout: 3000 });
    return result.trim().length > 0;
  } catch {
    return false;
  }
}

async function ensureDashboardRunning() {
  const port = process.env.PORT || 3000;
  const portUsed = await isPortInUse(port);

  if (portUsed) {
    console.log(`[CSO] Dashboard already running on port ${port}`);
    return;
  }

  if (!fs.existsSync(DASHBOARD_SERVER)) {
    console.log('[CSO] Dashboard server.js not found, skipping auto-start');
    return;
  }

  const logFile = path.join(__dirname, '../../dashboard/dashboard.log');
  const out = fs.openSync(logFile, 'a');
  const err = fs.openSync(logFile, 'a');

  const child = spawn('node', [DASHBOARD_SERVER], {
    detached: true,
    stdio: ['ignore', out, err],
    env: { ...process.env, PORT: String(port) }
  });
  child.unref();

  console.log(`[CSO] Dashboard started on port ${port} (pid: ${child.pid})`);
}

async function ensureDaemonRunning() {
  if (isProcessRunning('cso-daemon.js')) {
    console.log('[CSO] Daemon already running');
    return;
  }

  if (!fs.existsSync(DAEMON_SCRIPT)) {
    console.log('[CSO] Daemon script not found, skipping auto-start');
    return;
  }

  const logFile = path.join(__dirname, '../daemon/daemon.log');
  const out = fs.openSync(logFile, 'a');
  const err = fs.openSync(logFile, 'a');

  const child = spawn('node', [DAEMON_SCRIPT], {
    detached: true,
    stdio: ['ignore', out, err],
    cwd: CSO_WORKSPACE
  });
  child.unref();

  console.log(`[CSO] Daemon started (pid: ${child.pid})`);
}

onSessionStart().catch(err => {
  console.error('[CSO] Fatal error:', err);
  process.exit(1);
});
