---
name: feedback-claude-md-length
description: CLAUDE.md over ~150 lines causes model to drop protocol under task pressure — trim to tables + bullet rules, cut prose rationale
metadata:
  type: feedback
---

User complaint: "CSO doesn't get triggered, sometimes chat responds." Root cause: CLAUDE.md grew to 400+ lines including historical audit notes, routing enforcement prose, rationale paragraphs, and verbose examples. Model reads it once at session start, then ignores it under task pressure — the cognitive load of 400 lines means the protocol effectively doesn't exist mid-session.

Fixed: trimmed to ~100 lines. Kept: all hard rules (as bullets), routing tables, persona/model assignments, state file paths, decision delegation rules. Dropped: historical context ("2026-06-30 audit found..."), rationale paragraphs, duplicate enforcement prose, verbose examples.

Result verified by code-reviewer (opus): all four critical rules survived — hard-abstain list, subagent prompt discipline, absolute-path warning, editability rule.

**Why:** LLM context loading is front-heavy. A protocol the model can scan in 10 seconds is followed; one that takes 2 minutes to read is summarized and dropped. Tables and bullets are scannable; prose paragraphs are not.

**How to apply:** Keep CLAUDE.md under ~150 lines. When adding a new rule, remove one sentence of rationale prose to compensate. Never add historical/audit context to CLAUDE.md — that belongs in memory files or decisions.jsonl. If a rule needs more than one bullet to explain, it belongs in a memory file (which is loaded on demand), not in CLAUDE.md (which is loaded every session).

Related: [[feedback_hook_hard_enforcement]]
