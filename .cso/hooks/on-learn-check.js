#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const STATE_DIR = path.join(__dirname, '../state');
const FEEDBACK_LOG = path.join(STATE_DIR, 'feedback.jsonl');

async function onLearnCheck() {
  try {
    const input = await readStdin();
    if (!input) return;

    // Check if there were corrections in this session (feedback.jsonl has recent dissatisfied entries)
    const recentCorrections = getRecentCorrections();

    // Check if memory was updated recently (any .md file in project memory modified in last 2 hours)
    const memoryUpdated = checkMemoryUpdated();

    if (recentCorrections > 0 && !memoryUpdated) {
      console.log(`[CSO] ⚠️ LEARNING PASS OVERDUE: ${recentCorrections} correction(s) detected in this session but NO memory files updated.`);
      console.log(`[CSO] Before writing "CSO: Complete", you MUST:`);
      console.log(`[CSO]   1. Scan conversation for user corrections`);
      console.log(`[CSO]   2. Write memory files for each lesson learned`);
      console.log(`[CSO]   3. Update MEMORY.md index`);
      console.log(`[CSO] This is enforced. Do NOT skip.`);
    }
  } catch (error) {
    // Silent fail — don't block the session
  }
}

function getRecentCorrections() {
  if (!fs.existsSync(FEEDBACK_LOG)) return 0;

  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const lines = fs.readFileSync(FEEDBACK_LOG, 'utf-8').trim().split('\n').filter(Boolean);

  let count = 0;
  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      if (entry.type === 'dissatisfied' && entry.timestamp > twoHoursAgo) {
        count++;
      }
    } catch {}
  }
  return count;
}

function checkMemoryUpdated() {
  // Check all possible project memory directories
  const cwd = process.cwd();
  const projectKey = cwd.replace(/[\/ ]/g, '-');
  const memoryDir = path.join(
    process.env.HOME || '/Users/manojaaa',
    '.claude/projects',
    projectKey,
    'memory'
  );

  if (!fs.existsSync(memoryDir)) return false;

  const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
  const files = fs.readdirSync(memoryDir).filter(f => f.endsWith('.md') && f !== 'MEMORY.md');

  for (const file of files) {
    const stat = fs.statSync(path.join(memoryDir, file));
    if (stat.mtimeMs > twoHoursAgo) return true;
  }

  return false;
}

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', chunk => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
    setTimeout(() => resolve(''), 100);
  });
}

onLearnCheck().catch(() => {});
