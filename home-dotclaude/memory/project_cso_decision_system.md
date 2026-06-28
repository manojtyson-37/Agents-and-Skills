---
name: project-cso-decision-system
description: "CSO has real subagents in .claude/agents and a learning decision-maker; .cso/decision is tracked (learning persists), .cso/state is gitignored (runtime)."
metadata: 
  node_type: memory
  type: project
  originSessionId: ec6092c0-934c-49c2-82d0-68a49e9ba3f7
---

As of 2026-06-28, CSO gained (commit fd48a58):

- **Real subagents** in `.claude/agents/`: orchestrator, engineer, test-engineer,
  code-reviewer, ops, release-engineer, decision-maker. Old `agents/*.md` persona docs
  and 3 stub skills were deleted (folded into the subagents). bootstrap.sh symlinks
  these into `~/.claude/agents/` for cross-workspace use.
- **decision-maker** subagent: decides on the user's behalf for reversible/low-stakes
  choices, HARD-ABSTAINS on irreversible/money/secret/outward-facing. Learns from
  `.cso/decision/user_decision_profile.md` + `.cso/decision/decision_patterns.jsonl`,
  records every decision/override via `.cso/decision/record-decision.cjs`.

**Critical gitignore split:** `.cso/state/` is **gitignored** (machine-local runtime —
workflow_state, metrics, inbox, decisions ledger). `.cso/decision/` is **tracked** — that's
where the decision learning lives so it travels with the repo. Never put data that must
persist/travel under `.cso/state/`.

**Why:** User wanted CSO to learn his decision patterns and improve across machines;
the learning model must be versioned, not machine-local.

**How to apply:** Before AskUserQuestion on a non-critical choice, consult decision-maker.
After any decision (esp. user overrides), record it and update the profile. Relates to
[[feedback-repo-esm-scripts]] and [[feedback_public_repo_secret_handling]].
