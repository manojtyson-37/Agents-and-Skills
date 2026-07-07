#!/usr/bin/env node
/**
 * workflow-manager.cjs
 * Manage multi-workflow registry.
 *
 * Usage:
 *   node workflow-manager.cjs list
 *   node workflow-manager.cjs switch <objectiveId>
 *   node workflow-manager.cjs new '<objective>'
 *   node workflow-manager.cjs sync   (sync registry status from per-workflow files)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const STATE_DIR = path.join(__dirname, '../state');
const REGISTRY_FILE = path.join(STATE_DIR, 'workflows_registry.json');
const WORKFLOWS_DIR = path.join(STATE_DIR, 'workflows');
const WORKFLOW_STATE = path.join(STATE_DIR, 'workflow_state.json');

function loadRegistry() {
  if (!fs.existsSync(REGISTRY_FILE)) {
    return { version: 1, active: [], workflows: {} };
  }
  try {
    return JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf-8'));
  } catch {
    return { version: 1, active: [], workflows: {} };
  }
}

function saveRegistry(registry) {
  if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(REGISTRY_FILE, JSON.stringify(registry, null, 2));
}

function ensureWorkflowsDir() {
  if (!fs.existsSync(WORKFLOWS_DIR)) fs.mkdirSync(WORKFLOWS_DIR, { recursive: true });
}

const [,, cmd, ...args] = process.argv;

if (cmd === 'list') {
  const registry = loadRegistry();
  const entries = Object.values(registry.workflows);
  if (entries.length === 0) {
    console.log('[workflow-manager] No workflows registered. Run migrate-to-multi-workflow.cjs first.');
    process.exit(0);
  }

  const active = entries.filter(w => registry.active.includes(w.objectiveId));
  const inactive = entries.filter(w => !registry.active.includes(w.objectiveId));

  console.log(`\n[CSO] Workflows registry (${entries.length} total, ${active.length} active)\n`);
  console.log('  STATUS       ID                                LAST ACTIVE  OBJECTIVE');
  console.log('  ' + '-'.repeat(110));

  const fmt = (w) => {
    const id = (w.objectiveId || '').substring(0, 36).padEnd(38);
    const lastActive = w.lastActiveAt ? w.lastActiveAt.substring(0, 10) : '?'.padEnd(10);
    const statusTag = registry.active.includes(w.objectiveId) ? 'ACTIVE      ' : (w.status || 'unknown').substring(0, 11).padEnd(12);
    const obj = (w.objective || '').substring(0, 60);
    console.log(`  ${statusTag} ${id} ${lastActive}  ${obj}`);
  };

  active.forEach(fmt);
  if (inactive.length > 0) {
    console.log('');
    inactive.forEach(fmt);
  }
  console.log('');

} else if (cmd === 'switch') {
  const objectiveId = args[0];
  if (!objectiveId) {
    console.error('[workflow-manager] switch requires <objectiveId>');
    process.exit(1);
  }

  const registry = loadRegistry();
  const entry = registry.workflows[objectiveId];
  if (!entry) {
    console.error(`[workflow-manager] objectiveId not found: ${objectiveId}`);
    console.error('Run: node workflow-manager.cjs list');
    process.exit(1);
  }

  if (!fs.existsSync(entry.stateFile)) {
    console.error(`[workflow-manager] stateFile missing: ${entry.stateFile}`);
    process.exit(1);
  }

  // Persist current active workflow back to its per-workflow file before switching.
  // Without this, any in-progress work on the current workflow is silently lost.
  if (fs.existsSync(WORKFLOW_STATE)) {
    try {
      const current = JSON.parse(fs.readFileSync(WORKFLOW_STATE, 'utf-8'));
      const currentId = current.objectiveId;
      if (currentId && currentId !== objectiveId) {
        const currentEntry = (registry.workflows || {})[currentId];
        if (currentEntry && currentEntry.stateFile) {
          fs.writeFileSync(currentEntry.stateFile, JSON.stringify(current, null, 2));
          console.log(`[workflow-manager] Saved current workflow (${currentId}) before switching.`);
        }
      }
    } catch (e) {
      console.warn(`[workflow-manager] Could not save current workflow state: ${e.message}`);
    }
  }

  // Copy target workflow into workflow_state.json
  const targetState = fs.readFileSync(entry.stateFile, 'utf-8');
  fs.writeFileSync(WORKFLOW_STATE, targetState);

  // Update registry: set active to this workflow, update lastActiveAt
  entry.lastActiveAt = new Date().toISOString();
  if (!Array.isArray(registry.active)) registry.active = [];
  if (!registry.active.includes(objectiveId)) registry.active.push(objectiveId);
  saveRegistry(registry);

  const state = JSON.parse(targetState);
  const completed = (state.completedTasks || []).length;
  const total = Object.keys(state.tasks || {}).length;
  console.log(`[workflow-manager] Switched to: ${objectiveId}`);
  console.log(`[workflow-manager] Objective: ${(state.objective || '').substring(0, 100)}`);
  console.log(`[workflow-manager] Progress: ${completed}/${total} tasks done | status: ${state.status}`);
  console.log('[workflow-manager] workflow_state.json updated — hooks will resume this workflow.');

} else if (cmd === 'new') {
  const objective = args.join(' ').trim();
  if (!objective) {
    console.error('[workflow-manager] new requires <objective>');
    process.exit(1);
  }

  ensureWorkflowsDir();
  const objectiveId = `workflow-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const now = new Date().toISOString();

  const workflow = {
    objectiveId,
    objective: objective.substring(0, 500),
    status: 'bootstrapping',
    createdAt: now,
    startedAt: now,
    estimatedDuration: '2 hours',
    elapsedTime: '0 minutes',
    tasks: {},
    completedTasks: [],
    inProgressTask: 'task-breakdown',
    queuedTasks: [],
    blockers: [],
    nextAction: 'CSO: Breaking down objective into tasks...',
    lastSavedAt: now
  };

  const perWorkflowFile = path.join(WORKFLOWS_DIR, `${objectiveId}.json`);
  fs.writeFileSync(perWorkflowFile, JSON.stringify(workflow, null, 2));

  // Update registry
  const registry = loadRegistry();
  registry.workflows[objectiveId] = {
    objectiveId,
    workspace: process.cwd(),
    objective: workflow.objective,
    status: 'bootstrapping',
    stateFile: perWorkflowFile,
    createdAt: now,
    lastActiveAt: now
  };
  if (!registry.active.includes(objectiveId)) registry.active.push(objectiveId);
  saveRegistry(registry);

  // Write as current workflow_state.json
  fs.writeFileSync(WORKFLOW_STATE, JSON.stringify(workflow, null, 2));

  console.log(`[workflow-manager] New workflow created: ${objectiveId}`);
  console.log(`[workflow-manager] Objective: ${objective.substring(0, 100)}`);
  console.log('[workflow-manager] workflow_state.json updated — CSO will start planning.');

} else if (cmd === 'sync') {
  // Sync registry status from per-workflow files (in case they were updated externally)
  const registry = loadRegistry();
  ensureWorkflowsDir();
  let changed = 0;
  for (const [id, entry] of Object.entries(registry.workflows)) {
    if (!fs.existsSync(entry.stateFile)) continue;
    try {
      const state = JSON.parse(fs.readFileSync(entry.stateFile, 'utf-8'));
      if (entry.status !== state.status) {
        entry.status = state.status;
        changed++;
      }
      entry.lastActiveAt = state.lastSavedAt || entry.lastActiveAt;
    } catch {}
    // Prune from active if no longer active
    const isActive = entry.status === 'in-progress' || entry.status === 'bootstrapping';
    if (!isActive && registry.active.includes(id)) {
      registry.active = registry.active.filter(a => a !== id);
      changed++;
    } else if (isActive && !registry.active.includes(id)) {
      registry.active.push(id);
      changed++;
    }
  }
  saveRegistry(registry);
  console.log(`[workflow-manager] Sync complete. ${changed} entries updated.`);

} else {
  console.log('Usage:');
  console.log('  node workflow-manager.cjs list');
  console.log('  node workflow-manager.cjs switch <objectiveId>');
  console.log("  node workflow-manager.cjs new '<objective>'");
  console.log('  node workflow-manager.cjs sync');
  process.exit(1);
}
