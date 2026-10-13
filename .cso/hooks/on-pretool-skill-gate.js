#!/usr/bin/env node
// PreToolUse hook on the Skill tool.
// Denies Skill("cso") — that loads the gstack security audit, NOT the CSO orchestrator.
// The CSO orchestrator is the CLAUDE.md protocol; activating it means following
// plan→execute→review→notify directly, not invoking any skill.
//
// Root cause this fixes: model invoked Skill("cso") when user asked "audit CSO protocol"
// and "why is CSO not working?" — the security audit skill loaded instead of the protocol
// being followed. Prose memory alone (feedback_cso_skill_routing_confusion.md) did not
// prevent this across multiple sessions.

// BLOCKED_SKILLS is checked BEFORE CSO_ALLOWED_SKILLS so a future accidental
// addition of "cso" to the allowed set cannot silently bypass the block.
const BLOCKED_SKILLS = new Set(['cso']);

// Exception (user decision 2026-10-13): the block lifts when the user EXPLICITLY asked for
// gstack's security audit in their latest genuine message — typed `/cso`, or the phrase
// "security audit". "audit CSO protocol" / "why is CSO not working?" must still be denied.
// Fails closed: unreadable transcript, no genuine user message in the tail, a compaction
// boundary, any harness-tagged entry, or no match → deny.
//
// Self-contained on purpose (no cso-utils import): a missing helper must never fail OPEN.
// Transcript "user" entries are NOT all typed by the user — the harness also writes
// compaction summaries (isCompactSummary), slash-command/bash output, scheduled-task prompts,
// subagent hand-backs and skill expansions (isMeta). Only an allowlist of shapes may match.
const fs = require('fs');
const TRANSCRIPT_TAIL_BYTES = 1024 * 1024;
const SYSTEM_REMINDER_BLOCKS = /<system-reminder\b[^>]*>[\s\S]*?<\/system-reminder>/gi;
// Harness turns that interleave with a real prompt (agent hand-backs etc.): skip over them.
const SKIPPABLE_HARNESS_PREFIX = /^\s*(<(agent-message|task-notification|task-result|tool-result|ci-monitor-event)\b|\[Subagent hand-back\])/i;
// Typed slash command: the harness records it as <command-name>/cso</command-name> (either tag order).
const SLASH_CSO = /^\s*\/cso(?![\w-])|<command-name>\s*\/?cso\s*<\/command-name>/i;
const SECURITY_AUDIT_PHRASE = /\bsecurity audit\b/i;
// "don't run a security audit" must not unlock the gate.
const NEGATED_AUDIT = /\b(?:don['\u2019]?t|do not|dont|never|no|not|without|skip|avoid|instead of|rather than)\b[^.,?!\n]{0,20}\bsecurity audit\b/i;

function textOfUserEntry(e) {
  const c = e && e.message && e.message.content;
  if (typeof c === 'string') return c;
  if (Array.isArray(c)) {
    // A turn carrying a tool_result is the harness answering a tool call, never a typed prompt.
    if (c.some(p => p && p.type === 'tool_result')) return '';
    return c.filter(p => p && p.type === 'text' && typeof p.text === 'string').map(p => p.text).join('\n');
  }
  return '';
}

function isExplicitAuditRequest(text) {
  if (SLASH_CSO.test(text)) return true;
  return SECURITY_AUDIT_PHRASE.test(text) && !NEGATED_AUDIT.test(text);
}

function userExplicitlyRequestedAudit(transcriptPath) {
  try {
    if (!transcriptPath) return false;
    const fd = fs.openSync(transcriptPath, 'r');
    let tail;
    try {
      const size = fs.fstatSync(fd).size;
      const len = Math.min(size, TRANSCRIPT_TAIL_BYTES);
      const buf = Buffer.alloc(len);
      fs.readSync(fd, buf, 0, len, size - len);
      tail = buf.toString('utf-8');
    } finally { fs.closeSync(fd); }
    const lines = tail.split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
      let e;
      try { e = JSON.parse(lines[i]); } catch { continue; } // also drops a partial first line
      if (!e || e.type !== 'user' || e.isSidechain || e.isMeta) continue;
      // Compaction boundary: the model-written summary is stored as a user entry. Never trust it,
      // and do not look past it for an older request.
      if (e.isCompactSummary || e.isVisibleInTranscriptOnly) return false;
      const text = textOfUserEntry(e).replace(SYSTEM_REMINDER_BLOCKS, '').trim();
      if (!text) continue; // tool_result-only or reminder-only turn
      if (SKIPPABLE_HARNESS_PREFIX.test(text)) continue; // agent hand-back / task notification
      // Allowlist: a leading tag is only acceptable for the slash-command wrappers.
      // Anything else (local-command-stdout, bash-input/stdout, scheduled-task, …) is not typed text.
      if (text.startsWith('<') && !/^<command-(name|message)>/i.test(text)) return false;
      return isExplicitAuditRequest(text); // latest genuine user message decides
    }
    return false;
  } catch {
    return false;
  }
}

// Skill names arrive as "cso", "/cso", "gstack:cso", …; also tolerate stray args, path-ish and
// zero-width variants. Blocked if ANY segment is a blocked name.
function isBlockedSkillName(name) {
  const segments = String(name || '').toLowerCase().replace(/[\u200b-\u200d\ufeff]/g, '').split(/[\s:/]+/);
  return segments.some(seg => BLOCKED_SKILLS.has(seg));
}

// Skills legitimately used by CSO orchestration — always allow.
const CSO_ALLOWED_SKILLS = new Set([
  'cso-learn',
  'code-review',
  'security-review',
  'ship',
  'land-and-deploy',
  'verify',
  'qa',
  'design-review',
  'simplify',
  'find-skills',
]);

async function main() {
  try {
    const raw = await readStdin();
    if (!raw) return defer();

    let input;
    try {
      input = JSON.parse(raw);
    } catch {
      // Truncated/malformed payload: if it still names the blocked skill, fail closed.
      if (/"skill"\s*:\s*"\/?(?:[\w-]+:)?cso"/i.test(raw)) return denyCso(null);
      return defer();
    }
    const toolInput = input.tool_input || {};

    // skill name comes in as `skill` field on the Skill tool
    const skillName = String(toolInput.skill || '').trim();

    if (!skillName) return defer();

    // Block check runs first — CSO_ALLOWED_SKILLS cannot override a blocked skill.
    if (isBlockedSkillName(skillName)) return denyCso(input.transcript_path);

    return defer();
  } catch {
    return defer(); // never crash session over a hook bug
  }
}

function denyCso(transcriptPath) {
  if (transcriptPath && userExplicitlyRequestedAudit(transcriptPath)) return defer();
  return deny(
    `BLOCKED: Skill("cso") loads the gstack SECURITY AUDIT — NOT the CSO orchestrator.\n\n` +
    `To operate as CSO:\n` +
    `  1. Output "CSO: [objective]"\n` +
    `  2. Write a plan (tasks + owners + estimates)\n` +
    `  3. Execute → review → notify\n\n` +
    `DO NOT invoke any skill to "start CSO." The CSO orchestrator is the CLAUDE.md protocol.\n` +
    `The only CSO-related skills: cso-learn (mandatory before Complete), ` +
    `code-reviewer agent (review gate), ship/land-and-deploy (deploy).\n\n` +
    `If the user genuinely wants gstack's security audit, they must ask for it explicitly ` +
    `in their message (type /cso or say "security audit"); otherwise use /security-review.`
  );
}

function deny(reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    }
  }));
  process.exit(0);
}

function defer() {
  // Emit nothing: empty hook output means "no opinion, continue normally".
  // ('defer' is NOT a valid permissionDecision — emitting it made the harness
  // error out every Skill call, which is why skills kept interrupting mid-run.)
  process.exit(0);
}

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    let done = false;
    const finish = () => { if (!done) { done = true; clearTimeout(timer); resolve(data); } };
    // Keep whatever arrived: dropping it on timeout made a slow stdin fail OPEN.
    const timer = setTimeout(finish, 2000);
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', c => { data += c; });
    process.stdin.on('end', finish);
    process.stdin.on('error', finish);
  });
}

main();
