---
name: project_cso_reliability_gaps
description: "Known CSO reliability gaps as of 2026-06-30 audit — state files decorative, inbox dead, 5/7 agents never invoked"
metadata: 
  node_type: memory
  type: project
  originSessionId: 3fa6d797-6732-45d9-a3f5-05d144f9d3c8
---

Full-history audit (2026-06-30) of `.cso/state/` found the CSO "system" is mostly the
prompt-injection layer working correctly, but its tracking/automation claims don't hold up:

- `workflow_state.json` stuck at `status:"bootstrapping"`, `tasks:{}` since 2026-06-28
  despite multiple real sessions completing real work in between — never gets written to.
- `metrics.json` shows `tasksCompleted:0` despite confirmed completed work in
  `task_history.jsonl` — stale/decorative, don't cite it as evidence of progress.
- `inbox.json` persistent queue is write-only: Silaa ERP auth+deploy task sat
  `pending`/`blocked` 57+ hours untouched across sessions; nothing auto-resumes it.
- All-time `decisions.jsonl` tally: `test-engineer`, `code-reviewer`, `ops`,
  `release-engineer`, `decision-maker` = 0 invocations ever. Only `engineer` (10) and
  `orchestrator` (19) have real usage.
- Dashboard (port 3000) and daemon process ARE reliably running and the daemon does send
  real completion notifications when a workflow is explicitly driven to completion.

**Why:** CSO's enforcement and tracking were built as prose rules + soft hooks
(console.log warnings), which get read once and ignored under task pressure — see
[[feedback_hook_hard_enforcement]]. State files only get updated when the in-session
agent (me) remembers to write them, which is inconsistent.

**How to apply:** Don't claim CSO autonomously tracks/resumes work across sessions — it
doesn't, reliably. Don't cite dashboard/metrics.json numbers as ground truth — check
`task_history.jsonl` or git log instead. When the user asks "is X done", check actual
artifacts (code, git log), not `workflow_state.json`. Treat the 5 zero-invocation agent
personas as aspirational until actually exercised — if a task fits one, dispatch it for
real rather than assuming the routing table means it already happens.

Related: [[feedback_unused_routing_table]], [[feedback_hook_hard_enforcement]].
