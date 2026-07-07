---
name: feedback-cso-skill-routing-confusion
description: "Invoking /cso routes to the gstack security audit skill, NOT the CSO orchestrator. The CSO orchestrator is the CLAUDE.md protocol — never invoke a skill for it."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: bc181339-b20e-4cf1-a084-d890f33bc0bf
---

User said "CSO" and `Skill("cso")` was invoked — this loaded the gstack `/cso` security audit skill, which has nothing to do with the CSO orchestrator protocol. The user wanted CSO to start operating, not run a security scan.

The CSO Chief of Staff Orchestrator is NOT a skill. It is the protocol defined in CLAUDE.md. To activate it: just follow CLAUDE.md (plan→execute→review→notify). Do NOT invoke any skill to "start CSO."

**Why:** Skill names and protocol names overlap. `/cso` as a skill = security audit. "CSO" as a protocol = the orchestrator in CLAUDE.md. Invoking the skill when the user says "CSO" is always wrong.

**How to apply:**
- Never invoke `Skill("cso")` unless the user explicitly asks for a security audit.
- When user says "CSO go", "CSO start", "audit CSO", or asks why CSO isn't working: activate the CLAUDE.md protocol directly (output "CSO: [objective]", write plan, execute).
- The only skills relevant to CSO orchestration: `cso-learn` (mandatory before Complete), `code-reviewer` (review gate), `ship`/`land-and-deploy` (deploy).
- **Prose memory alone does not prevent this.** This memory file exists and was written — yet `Skill("cso")` was still invoked in the 2026-07-08 session. The fix requires a hook-level block, not more prose. The UserPromptSubmit hook should detect `Skill("cso")` invocation and warn before it loads.

Related: [[feedback_session_objective_enforcement]], [[feedback_hook_hard_enforcement]]
