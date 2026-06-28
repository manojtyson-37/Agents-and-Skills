---
name: feedback-session-continuity
description: "State files + cso-learn persist decisions/principles, NOT the full conversation. Session checkpoints (session_log.jsonl) + claude-mem carry narrative context across sessions."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: ec6092c0-934c-49c2-82d0-68a49e9ba3f7
---

**Logged ≠ remembered.** CSO state files (workflow_state, decisions.jsonl) and cso-learn
memories persist *decisions and distilled principles*, but NOT the session narrative — so a
fresh session reconstructs only partial context. User flagged this as "a breaker" (2026-06-28)
after a new session couldn't recall the full prior thread.

**Fix built (commit 2c98a2f) — 3-layer session continuity:**
1. `SessionEnd` hook → auto-checkpoint to `.cso/state/session_log.jsonl` (objective, status,
   progress, open tasks, last 8 decisions). Always runs.
2. `.cso/checkpoint/log-session.cjs` → RICH checkpoint (summary + openThreads + nextActions);
   CSO MUST call it at "CSO: Complete." (NOTIFY phase). Skips the auto one if rich is recent.
3. `SessionStart` hook → surfaces the last checkpoint as "[CSO] Last session: …" recap.
Plus claude-mem = automatic deep/vector recall.

**Why:** A self-sufficient CSO must resume with real context, not re-derive from thin state.

**How to apply:** ALWAYS write a rich checkpoint at Complete (it's now a NOTIFY step). On
SessionStart, read the recap before acting. session_log.jsonl is machine-local (`.cso/state`,
gitignored) — for cross-machine continuity rely on claude-mem + curated memory. Restart Claude
Code after installing hooks/plugins so they activate. See [[reference-superpowers-claudemem]]
and [[feedback-sync-memory-to-repo]].
