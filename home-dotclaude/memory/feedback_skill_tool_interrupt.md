---
name: feedback-skill-tool-interrupt
description: "/cso-learn Skill tool can be interrupted by the Claude Code runtime — fallback: do the learning pass inline and log decision manually"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 301a34c3-4196-4277-8907-67950239d98c
---

`Skill("cso-learn")` can fail with "Tool execution was interrupted" — Claude Code runtime stops the tool call mid-execution, no result returned.

**Why:** Skill tool invocation is not guaranteed stable; runtime can interrupt it (seen at session end under certain contexts).

**Root-cause fix, 2026-07-08: stop calling `Skill("cso-learn")` at all.** The Stop-hook gate (`.cso/hooks/on-stop-gate.js` gate-1-learning, ~line 184) never checks that the Skill tool ran — it only checks `decisions.jsonl` for any entry whose lowercased JSON contains the substring `"cso-learn"` (`JSON.stringify(e).toLowerCase().includes('cso-learn')` — substring match, not an exact key). Calling the Skill tool was always optional plumbing, not what satisfies the gate. Since the Skill tool for this specific skill is flaky, don't call it — just do the documented process (`.claude/skills/cso-learn/SKILL.md`: scan for corrections/confirmations, write/update memory files, update MEMORY.md, append a decisions.jsonl entry containing the word "cso-learn") directly as instructions, every session-end, with zero dependency on the Skill tool succeeding.

**How to apply:**
- Never invoke `Skill("cso-learn")` — read `.claude/skills/cso-learn/SKILL.md` once if needed, then always execute its process inline.
- Any decisions.jsonl entry containing the substring "cso-learn" (case-insensitive) anywhere in its JSON satisfies the gate — no special key required, no need to grep-verify a specific field, just include the word in the decision text.
- Also: when dispatching any background agent, immediately tell user: "Agent running in background — will continue automatically when it responds. No action needed from you."
