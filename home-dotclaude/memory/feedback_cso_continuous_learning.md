---
name: feedback-cso-continuous-learning
description: "User directive (2026-07-08): CSO must be a continuous learning agent — /cso-learn after every session, decision profile updated on every correction, self-repair tasks must execute not just queue"
metadata:
  type: feedback
---

User explicitly stated: "I want CSO to be a continuous learning agent."

This means three things that are currently broken:

1. **`/cso-learn` must run every session end** — not just when the Stop gate catches it. The gate catches skips but sessions were still ending without learning passes (`decisions.jsonl` has 6 consecutive FAILURE entries from 2026-07-05). The gate is a safety net; the behavior must be proactive.

2. **Decision profile must update on every correction** — the profile was last updated 2026-07-03 (13 patterns). Multiple corrections happened after that date with no profile update. Every time a user overrides a CSO decision or corrects a behavior, a new pattern entry must be written to `user_decision_profile.md` immediately, not deferred to cso-learn.

3. **Self-repair tasks must actually execute** — the loop currently: detect problem → write inbox task → task gets cancelled. The loop must close: detect → queue → execute (in current or next session) → verify fixed → log learning.

**Why:** "Learning agent" means behavior changes based on history. Currently CSO detects its own failures (self-repair triggers correctly) but doesn't fix them (tasks get cancelled, profile stays stale).

**How to apply:**
- End of every session: run `/cso-learn` before checkpoint, no exceptions.
- After any user correction mid-session: immediately append a new pattern to `user_decision_profile.md`.
- At session start: check `inbox.json` for `source:"self-repair"` tasks with `status:"pending"` and execute them BEFORE starting new work.
- The decision-maker agent must be dispatched for non-critical choices — not engineer persona deciding inline. Profile only stays current if decisions get routed through it.

Related: [[feedback_self_repair_task_protection]], [[feedback_cso_self_repair_design]], [[feedback_session_objective_enforcement]]
