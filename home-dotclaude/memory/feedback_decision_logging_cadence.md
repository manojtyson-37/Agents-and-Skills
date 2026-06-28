---
name: feedback-decision-logging-cadence
description: "Log to decisions.jsonl as each decision happens in-session, not only retroactively at CSO Complete"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 4b79da6f-21c3-46b4-adfa-4aa72bdcf9a2
---

Call `record-decision.cjs` right after a real decision is made (tool choice, stop/continue call, approach pick) — not batched and backfilled at the end of a session.

**Why:** Caught skipping this across a whole research+scrape thread (3D website research, motionsites.ai prompt scraping) — two real judgment calls were made (browse vs WebFetch, stop-scraping-early) and never logged until the user asked directly "are you recording decisions?" Had to reconstruct and backfill after the fact.

**How to apply:** Any AskUserQuestion answer, any "I'll stop here / I'll try X instead" pivot, any decision-maker consult result — log it immediately, same turn. Don't wait for task completion to write the paper trail.
