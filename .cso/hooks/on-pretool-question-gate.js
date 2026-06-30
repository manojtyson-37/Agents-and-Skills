#!/usr/bin/env node
// PreToolUse hook on AskUserQuestion. Schema verified against gstack's own
// question-preference-hook.ts (.claude/skills/gstack/hosts/claude/hooks/): output is
// {hookSpecificOutput: {hookEventName:'PreToolUse', permissionDecision:'deny'|'defer', permissionDecisionReason}}.
// NOTE: an earlier version of this file emitted the fields flat (not nested under
// hookSpecificOutput) — code-reviewer caught it as a silent no-op (Claude Code wouldn't
// recognize the flat shape, so it always fails open / never actually blocks). Verify any
// future edit against the reference file's exact nesting, don't re-guess.
// "defer" = let the question proceed normally. "deny" = block the tool call, model sees
// the reason and must act on it before retrying.
//
// Enforces CLAUDE.md's Decision Delegation rule, which was being violated session after
// session: "Before asking the user a non-critical question, consult the decision-maker
// subagent." Real audit 2026-06-30 found decision-maker at 0 invocations ever, including
// the very session that audited CSO and asked the user 4+ AskUserQuestion calls without
// consulting it once. See feedback_unused_routing_table.md.

const fs = require('fs');
const path = require('path');

const STATE_DIR = path.join(__dirname, '../state');
const DECISIONS_LOG = path.join(STATE_DIR, 'decisions.jsonl');

// HARD ABSTAIN categories from CLAUDE.md — decision-maker may recommend but never
// auto-decides these, so there is no point gating on it: always let the question through.
const HARD_ABSTAIN_RE = /\b(delete|destroy|drop|overwrite|wipe|uninstall|irreversible|force.?push|rm -rf|reset.{0,20}(data|db|database)|\$\d|dollar|pricing|purchase|invoice|refund|payment|secret|credential|password|api.?key|token|security|vulnerability|publish|deploy|production|release to|ship to)\b/i;

async function main() {
  try {
    const raw = await readStdin();
    if (!raw) return defer();
    const input = JSON.parse(raw);

    const questions = (input.tool_input && input.tool_input.questions) || [];
    const text = questions.map(q => [q.question, ...(q.options || []).map(o => o.label || o.description || o)].join(' ')).join(' ');

    if (HARD_ABSTAIN_RE.test(text)) return defer();

    const tenMinAgo = Date.now() - 10 * 60 * 1000;
    const consulted = countRecent(DECISIONS_LOG, tenMinAgo, e =>
      String(e.persona || '').toLowerCase() === 'decision-maker'
    ) > 0;

    if (consulted) return defer();

    return deny(
      `CLAUDE.md Decision Delegation rule: consult the decision-maker subagent before asking ` +
      `a non-critical question. Dispatch it now (Agent tool, subagent_type: decision-maker) with ` +
      `this question's context. If it returns high confidence on a reversible/low-stakes choice, ` +
      `take that decision yourself and tell the user what you decided and why — do not re-ask. ` +
      `Otherwise, log a decisions.jsonl entry with persona:"decision-maker" and retry the question.`
    );
  } catch (e) {
    logError(e); // fail open, but don't fail silently — malformed input should be visible
    return defer();
  }
}

function logError(e) {
  try {
    fs.appendFileSync(
      path.join(STATE_DIR, 'hook-errors.log'),
      `${new Date().toISOString()} on-pretool-question-gate: ${e && e.message || e}\n`
    );
  } catch {}
}

function countRecent(file, sinceMs, predicate) {
  if (!fs.existsSync(file)) return 0;
  const lines = fs.readFileSync(file, 'utf-8').trim().split('\n').filter(Boolean);
  let n = 0;
  for (const line of lines) {
    try {
      const e = JSON.parse(line);
      const ts = Date.parse(e.timestamp || 0);
      if (ts >= sinceMs && predicate(e)) n++;
    } catch {}
  }
  return n;
}

function defer() {
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'defer' } }));
  process.exit(0);
}

function deny(reason) {
  process.stdout.write(JSON.stringify({ hookSpecificOutput: {
    hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason
  } }));
  process.exit(0);
}

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', c => { data += c; });
    process.stdin.on('end', () => resolve(data));
    setTimeout(() => resolve(''), 100);
  });
}

main();
