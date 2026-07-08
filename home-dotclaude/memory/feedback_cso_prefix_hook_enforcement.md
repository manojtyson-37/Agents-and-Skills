---
name: feedback-cso-prefix-hook-enforcement
description: "CSO: prefix Hard Rule was prose-only and got dropped under task pressure — now enforced by a real Stop-hook gate (Gate 8 in on-stop-gate.js)"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 301a34c3-4196-4277-8907-67950239d98c
---

CLAUDE.md Hard Rule "every response must start with CSO:" was prose only. In one session (2026-07-08) two responses in a row skipped the prefix mid-task, user caught both. Same pattern as [[feedback_cso_skill_routing_confusion]] — prose rules read once, dropped under pressure.

**Fix shipped:** `.cso/hooks/on-stop-gate.js` Gate 8 — parses transcript for the last main-thread (non-sidechain) assistant text message this session, blocks the turn from ending if it doesn't start with `CSO:`. Code-reviewer (opus) caught a real blocker in the first version: without filtering `e.isSidechain`, a dispatched subagent's reply (which never has the CSO: prefix) would false-block the main thread. Fixed with `if (e.type !== 'assistant' || e.isSidechain) continue;`.

**Why:** Prose-only enforcement of hard rules does not survive task pressure. Only Stop-hook blocking actually works — matches [[feedback_session_objective_enforcement]].

**How to apply:**
- Any future "must always X in every response" rule → don't just add prose to CLAUDE.md, build a Stop-hook gate.
- When adding a new transcript-parsing gate, always filter `isSidechain` unless the check is specifically about subagent behavior — the transcript file interleaves main-thread and dispatched-agent turns.
- Always dispatch code-reviewer (opus) on new hook code before considering it done — this is the second time it's caught a real bug in one of these gates on the first pass.
