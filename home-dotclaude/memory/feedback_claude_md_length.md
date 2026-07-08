---
name: feedback-claude-md-length
description: "150-line cap overridden by user 2026-07-08 — no longer trim CLAUDE.md to hit a line target; enforcement now via Stop-hook gates, not brevity"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 301a34c3-4196-4277-8907-67950239d98c
---

User complaint: "CSO doesn't get triggered, sometimes chat responds." Root cause: CLAUDE.md grew to 400+ lines including historical audit notes, routing enforcement prose, rationale paragraphs, and verbose examples. Model reads it once at session start, then ignores it under task pressure — the cognitive load of 400 lines means the protocol effectively doesn't exist mid-session.

Fixed: trimmed to ~100 lines. Kept: all hard rules (as bullets), routing tables, persona/model assignments, state file paths, decision delegation rules. Dropped: historical context ("2026-06-30 audit found..."), rationale paragraphs, duplicate enforcement prose, verbose examples.

Result verified by code-reviewer (opus): all four critical rules survived — hard-abstain list, subagent prompt discipline, absolute-path warning, editability rule.

**Why:** LLM context loading is front-heavy. A protocol the model can scan in 10 seconds is followed; one that takes 2 minutes to read is summarized and dropped. Tables and bullets are scannable; prose paragraphs are not.

**Overridden 2026-07-08 by explicit user instruction:** user rejected the 150-line cap outright — "what is the point of restricting" if CSO needs the context. Line-count is no longer a target. Rationale: this cap was compensating for prose-only enforcement (model reads once, ignores under pressure). As of 2026-07-08 the load-bearing rules (CSO: prefix, etc.) are moving to real Stop-hook gates (see [[feedback_cso_prefix_hook_enforcement]]) — enforcement no longer depends on the file being short enough to stay salient. Keep tables/bullets over prose for scannability, but do not trim content or refuse additions to hit a line target.

**Still worth doing:** don't pad with historical/audit narrative that belongs in decisions.jsonl — but this is a quality preference, not a hard limit.

Related: [[feedback_hook_hard_enforcement]], [[feedback_cso_prefix_hook_enforcement]]
