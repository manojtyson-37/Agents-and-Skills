#!/usr/bin/env node
// Shared utilities for CSO hooks. Import with require('./cso-utils').

const fs = require('fs');
const path = require('path');

/**
 * Returns true if any project memory file (excluding MEMORY.md) was modified
 * at or after sinceMs. Used by on-stop-gate.js and on-learn-check.js.
 */
function checkMemoryUpdated(sinceMs) {
  const cwd = process.cwd();
  const projectKey = cwd.replace(/[\/ ]/g, '-');
  const memoryDir = path.join(
    process.env.HOME || '/Users/manojaaa',
    '.claude/projects',
    projectKey,
    'memory'
  );
  if (!fs.existsSync(memoryDir)) return false;
  const files = fs.readdirSync(memoryDir).filter(f => f.endsWith('.md') && f !== 'MEMORY.md');
  for (const f of files) {
    if (fs.statSync(path.join(memoryDir, f)).mtimeMs >= sinceMs) return true;
  }
  return false;
}

module.exports = { checkMemoryUpdated };
