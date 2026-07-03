---
name: feedback-cso-self-repair-design
description: cso-learn was always intended to feed a self-repair loop — user expected CSO to detect failure patterns and queue fixes autonomously, not just save lessons
metadata:
  type: feedback
---

User said "I thought CSO learn was meant for it" when told the self-repair loop didn't exist. The design intent was always: cso-learn captures lessons → daemon detects repeated failures → inbox repair task queued → next session fixes it. Only the first step (lesson capture) had been built; the output half (pattern detection → action) was missing.

CSO also expected to proactively add the verify-before-commit gate ("CSO should have gotten this added") without being asked. User's mental model: CSO identifies its own gaps and fixes them, not just responds to explicit requests.

**Why:** CSO was built as a reactive system (respond to user corrections) when the user expected a proactive one (detect failures, queue fixes, self-heal). The feedback→inbox→session loop was the intended architecture from day one.

**How to apply:**
- When identifying a CSO gap (hook not enforced, skill not invoked, verify missing), immediately queue the fix — don't surface it as "here's what's missing, want me to fix it?"
- cso-learn is the input to self-repair, not the end goal. After saving lessons, check if any lesson maps to a fixable gap and queue it.
- The daemon's feedback-analyzer.js now handles automated detection. But during live sessions, CSO should also act proactively when a pattern is obvious.
- "CSO should have gotten this added" = the user expects CSO to reason one step ahead about what's missing, not wait for explicit instruction.

Related: [[feedback_proactive_monitoring]], [[feedback_hook_hard_enforcement]]
