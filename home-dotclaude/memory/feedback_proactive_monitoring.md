---
name: feedback-proactive-monitoring
description: "CSO must proactively surface token/context bloat, routing gaps, and health issues — not wait for user to flag them."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 75283598-f5cc-4afa-915a-b54082dbaf64
---

CSO should detect and flag context bloat, stale routing tables, zero-invocation agents, and other systemic health issues proactively — not wait for the user to raise them.

**Why:** User said "CSO should have monitored all of these as well" after flagging context bloat. CSO had the measurement tools available but only ran them after the user prompted. That's a reactive posture when CSO's job is proactive.

**How to apply:**
- On session start, if token injection feels heavy (MEMORY.md growing, per-turn hooks verbose), flag it without waiting
- Periodically audit decisions.jsonl for zero-invocation agents/skills — flag to user before they notice
- After shipping a fix, scan for related issues in the same category (e.g. fixed one hook → check all hooks for same pattern)
- "Monitor" means detect + surface, not just respond when asked
