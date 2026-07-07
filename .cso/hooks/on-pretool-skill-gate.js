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

    const input = JSON.parse(raw);
    const toolInput = input.tool_input || {};

    // skill name comes in as `skill` field on the Skill tool
    const skillName = String(toolInput.skill || '').toLowerCase().trim();

    if (!skillName) return defer();

    // Block check runs first — CSO_ALLOWED_SKILLS cannot override a blocked skill.
    if (BLOCKED_SKILLS.has(skillName)) {
      return deny(
        `BLOCKED: Skill("cso") loads the gstack SECURITY AUDIT — NOT the CSO orchestrator.\n\n` +
        `To operate as CSO:\n` +
        `  1. Output "CSO: [objective]"\n` +
        `  2. Write a plan (tasks + owners + estimates)\n` +
        `  3. Execute → review → notify\n\n` +
        `DO NOT invoke any skill to "start CSO." The CSO orchestrator is the CLAUDE.md protocol.\n` +
        `The only CSO-related skills: cso-learn (mandatory before Complete), ` +
        `code-reviewer agent (review gate), ship/land-and-deploy (deploy).`
      );
    }

    return defer();
  } catch {
    return defer(); // never crash session over a hook bug
  }
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
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'defer',
    }
  }));
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
