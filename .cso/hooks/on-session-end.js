#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const STATE_DIR = path.join(__dirname, '../state');
const WORKFLOW_STATE = path.join(STATE_DIR, 'workflow_state.json');
const METRICS_FILE = path.join(STATE_DIR, 'metrics.json');

async function onSessionEnd() {
  try {
    // Ensure state directory exists
    if (!fs.existsSync(STATE_DIR)) {
      fs.mkdirSync(STATE_DIR, { recursive: true });
    }

    // Save current workflow state
    if (fs.existsSync(WORKFLOW_STATE)) {
      const state = JSON.parse(fs.readFileSync(WORKFLOW_STATE, 'utf-8'));

      // Update end time
      state.lastSavedAt = new Date().toISOString();

      // Write back
      fs.writeFileSync(WORKFLOW_STATE, JSON.stringify(state, null, 2));
      console.log('[CSO] Workflow state saved');

      // Log metrics
      if (fs.existsSync(METRICS_FILE)) {
        const metrics = JSON.parse(fs.readFileSync(METRICS_FILE, 'utf-8'));
        console.log(`[CSO] Session metrics:`);
        console.log(`  Tasks: ${metrics.tasksCompleted}/${metrics.totalTasksPlanned} complete`);
        console.log(`  Tokens saved: ${metrics.compressionPercent.toFixed(1)}%`);
      }
    }

    console.log('[CSO] Session end. State persisted.');
  } catch (error) {
    console.error('[CSO] Session end error:', error.message);
  }
}

onSessionEnd().catch(err => {
  console.error('[CSO] Fatal error:', err);
  process.exit(1);
});
