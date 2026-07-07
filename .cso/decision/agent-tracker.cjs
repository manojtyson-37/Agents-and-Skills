#!/usr/bin/env node
/**
 * agent-tracker.cjs
 * Track parallel subagent dispatches.
 *
 * Usage:
 *   node agent-tracker.cjs start   '{"agentId":"...","persona":"engineer","task":"...","workflowId":"..."}'
 *   node agent-tracker.cjs complete '{"agentId":"...","outcome":"success","note":"..."}'
 *   node agent-tracker.cjs list
 */

'use strict';

const fs = require('fs');
const path = require('path');

const STATE_DIR = path.join(__dirname, '../state');
const AGENTS_STATE = path.join(STATE_DIR, 'agents_state.json');

function load() {
  if (!fs.existsSync(AGENTS_STATE)) {
    return { version: 1, running: [], completed: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(AGENTS_STATE, 'utf-8'));
  } catch {
    return { version: 1, running: [], completed: [] };
  }
}

function save(state) {
  if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(AGENTS_STATE, JSON.stringify(state, null, 2));
}

const [,, cmd, payloadRaw] = process.argv;

if (cmd === 'start') {
  let payload;
  try { payload = JSON.parse(payloadRaw || '{}'); } catch {
    console.error('[agent-tracker] Invalid JSON payload');
    process.exit(1);
  }

  const { agentId, persona, task, workflowId } = payload;
  if (!agentId || !persona || !task) {
    console.error('[agent-tracker] start requires agentId, persona, task');
    process.exit(1);
  }

  const state = load();
  // Remove any stale entry with same agentId
  state.running = state.running.filter(a => a.agentId !== agentId);
  state.running.push({
    agentId,
    persona,
    task,
    workflowId: workflowId || null,
    startedAt: new Date().toISOString(),
    status: 'running'
  });
  save(state);
  console.log(`[agent-tracker] Started: ${agentId} (${persona}) — ${task}`);

} else if (cmd === 'complete') {
  let payload;
  try { payload = JSON.parse(payloadRaw || '{}'); } catch {
    console.error('[agent-tracker] Invalid JSON payload');
    process.exit(1);
  }

  const { agentId, outcome, note } = payload;
  if (!agentId) {
    console.error('[agent-tracker] complete requires agentId');
    process.exit(1);
  }

  const state = load();
  const idx = state.running.findIndex(a => a.agentId === agentId);
  if (idx === -1) {
    console.warn(`[agent-tracker] agentId ${agentId} not found in running — may already be complete`);
  } else {
    const agent = state.running.splice(idx, 1)[0];
    agent.status = 'completed';
    agent.outcome = outcome || 'unknown';
    agent.note = note || '';
    agent.completedAt = new Date().toISOString();
    state.completed.push(agent);
    // Keep completed list bounded to last 100
    if (state.completed.length > 100) {
      state.completed = state.completed.slice(-100);
    }
  }
  save(state);
  console.log(`[agent-tracker] Completed: ${agentId} (${outcome || 'unknown'})`);

} else if (cmd === 'list') {
  const state = load();
  if (state.running.length === 0) {
    console.log('[agent-tracker] No agents currently running.');
  } else {
    console.log(`[agent-tracker] Running agents (${state.running.length}):`);
    console.log('');
    const rows = state.running.map(a => {
      const elapsed = a.startedAt
        ? Math.round((Date.now() - new Date(a.startedAt).getTime()) / 60000) + 'm'
        : '?';
      return `  ${a.persona.padEnd(16)} ${a.agentId.substring(0, 20).padEnd(22)} ${elapsed.padEnd(6)} ${a.task.substring(0, 60)}`;
    });
    console.log('  PERSONA          AGENT-ID               ELAPSED  TASK');
    console.log('  ' + '-'.repeat(100));
    rows.forEach(r => console.log(r));
  }
  if (state.completed.length > 0) {
    const recent = state.completed.slice(-5);
    console.log(`\n[agent-tracker] Recent completed (last ${recent.length}):`);
    recent.forEach(a => {
      console.log(`  ${a.persona} / ${a.agentId} — ${a.outcome} — ${a.task.substring(0, 60)}`);
    });
  }

} else {
  console.log('Usage:');
  console.log('  node agent-tracker.cjs start   \'{"agentId":"...","persona":"engineer","task":"...","workflowId":"..."}\'');
  console.log('  node agent-tracker.cjs complete \'{"agentId":"...","outcome":"success","note":"..."}\'');
  console.log('  node agent-tracker.cjs list');
  process.exit(1);
}
