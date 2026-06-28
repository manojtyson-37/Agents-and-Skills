---
name: feedback-existing-session-fixes
description: "Fixes must work in existing sessions, not just new ones — user can't always restart"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: facfa3cd-2762-4467-b784-bdf7042f27d3
---

When fixing cross-session or cross-workspace issues, the fix must work in already-running sessions, not just new ones.

**Why:** User said "The conversation is ongoing and there is a lot of context, cannot restart the session there." CLAUDE.md only loads at session start. Hooks inject on every prompt — use hook injection for fixes that need to reach existing sessions.

**How to apply:** For protocol changes that need immediate effect: add to hook `console.log` output (injected as "additional context" every prompt). For changes that can wait: CLAUDE.md is fine. Always consider: "does the user need to restart for this to take effect?" If yes, find a hook-based alternative. Also: when placing code in hooks, ensure it runs unconditionally — don't put it after early `return` statements.
