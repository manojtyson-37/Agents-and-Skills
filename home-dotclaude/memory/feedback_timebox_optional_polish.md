---
name: feedback-timebox-optional-polish
description: "Time-box quota/rate-limit-gated work; separate core value from optional polish and don't grind on polish — user hates time spent without output."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: ec6092c0-934c-49c2-82d0-68a49e9ba3f7
---

Don't sink time into work gated by external rate limits / free-tier quotas. Before
starting, **say which part is core value vs optional polish**, deliver the core, and
**time-box the polish to ONE attempt** — if it doesn't land, stop and keep the core.

Concrete miss (graphify/Gemini, 2026-06-28): code graph = core value (done, free).
Community naming + doc nodes = optional polish, but gated by Gemini free tier (503
overload, `limit:0` on gemini-2.0-flash, daily caps). I kept retrying across models for
~15 min; user complained twice: "too much time consuming without actual output." Naming
also needs a separate `graphify label` LLM pass — more quota grind.

**Why:** User explicitly values output over effort and dislikes long quota-fighting with
nothing to show. Free tiers often can't finish a real workload in one session.

**How to apply:** (1) Up front, name the core deliverable and ship it first. (2) Flag
quota/rate-limit risk before starting a paid/free-tier pass; set the expectation it may
not finish. (3) One shot on the optional layer, then stop — offer to resume "another day
when quota resets" rather than grinding now. See [[feedback-safe-tool-trials]] and
[[feedback-local-llm-laptop-cost]].
