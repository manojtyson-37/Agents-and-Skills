---
name: feedback-self-repair-task-protection
description: "Self-repair tasks written by the daemon get bulk-cancelled with user inbox tasks; they must survive 'clear inbox' because they are infrastructure fixes, not user tasks"
metadata:
  type: feedback
---

All self-repair tasks in inbox.json were cancelled with `closedReason: "user: no open tasks needed"`. This means the daemon detected real CSO gaps (functionality regression, missing features, design quality, dissatisfaction), wrote tasks to the inbox, and then those tasks were silently swept away with user task cleanup — so the self-repair never executed.

**Why:** inbox.json treats all tasks the same. When user says "clear inbox" or "no open tasks needed", both user-created tasks and daemon-generated self-repair tasks get cancelled. Self-repair tasks are infrastructure (CSO fixing itself), not user requests, so they should not be clearable the same way.

**How to apply:**
- When processing inbox tasks: self-repair tasks have `source: "self-repair"` in their JSON. Do NOT cancel these with bulk-cancel unless the user explicitly says "cancel self-repair tasks."
- Before "CSO: Complete." — check if any `source:"self-repair"` tasks are still `status:"pending"`. If yes, execute them or explicitly defer with a reason.
- Daemon self-repair tasks represent CSO catching its own failures. Cancelling them = ignoring known bugs in CSO itself.
