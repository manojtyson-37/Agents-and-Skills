---
name: feedback_unused_routing_table
description: CSO routing tables (agents+skills) were read but never invoked — 5/7 agents and ~14 skills had zero calls ever; added hard enforcement gate to CLAUDE.md
metadata: 
  node_type: memory
  type: feedback
  originSessionId: c5bbbf70-fc1c-48a4-b61a-46cb1100b035
---

Audit on 2026-06-30 of `.cso/state/decisions.jsonl` + `task_history.jsonl` + `session_log.jsonl` found `code-reviewer`, `decision-maker`, `ops`, `release-engineer`, `test-engineer` agents at **zero invocations**, and routing-table skills (`/cso-learn`, `/find-skills`, `/code-review`, `/security-review`, `/verify`, `/qa`, `/grill-me`, `/simplify`, etc.) also at zero or near-zero, despite several marked MANDATORY in CLAUDE.md (e.g. `/cso-learn` before every Complete).

**Why:** Having a routing table in CLAUDE.md is not the same as following it. Under task pressure CSO defaults to doing work inline and skips the dispatch/discovery step every time — the table is read once at session start then ignored. User flagged this as resource waste: agents/skills installed and "expected to work" but never exercised provide zero value and add false confidence ("we have a code-reviewer step" when it never runs).

**How to apply:** Added a "Routing Enforcement (HARD GATE)" section to both CLAUDE.md files (global `home-dotclaude/CLAUDE.md` + project) right before Routing Rules:
- Unmapped task → must call `/find-skills` first, log outcome to decisions.jsonl. No silent inline-build skip.
- No "CSO: Complete." without a decisions.jsonl entry proving `/cso-learn` actually ran.
- REVIEW phase needs real code-reviewer agent or `/code-review` output, not self-grading.
- Periodic re-audit (grep agent/skill names across logs) — anything still at zero after being "mandatory" gets flagged to user as dead weight, either start using or cut from table.

Related: [[feedback_route_new_skills]] (installing ≠ using), [[feedback_framework_sprawl]] (more tools ≠ better — this is the flip side: tools that exist but don't get used are the same waste as redundant tools), [[feedback_hook_hard_enforcement]] (this CLAUDE.md fix itself failed same-day — superseded by a real Stop hook).

**UPDATE 2026-06-30 (later same day):** User re-audited and the "HARD GATE" prose section above had **zero effect** — re-grepped decisions.jsonl/task_history.jsonl immediately after and found the same 5 agents + 7 skills still at zero invocations. The prose fix for "prose rules get ignored" was itself another prose rule, and got ignored the same way. See [[feedback_hook_hard_enforcement]] for what actually fixed it.
