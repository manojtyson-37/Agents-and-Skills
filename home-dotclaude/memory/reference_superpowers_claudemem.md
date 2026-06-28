---
name: reference-superpowers-claudemem
description: "superpowers (MIT, methodology/TDD) + claude-mem (Apache-2.0, auto episodic memory) installed 2026-06-28; roles consolidated into CSO layered architecture."
metadata: 
  node_type: memory
  type: reference
  originSessionId: ec6092c0-934c-49c2-82d0-68a49e9ba3f7
---

Installed 2026-06-28 as Claude Code plugins (user scope):
- **superpowers** (obra, MIT, 240K★) — methodology framework. Skills: brainstorming,
  writing-plans, test-driven-development, subagent-driven-development, systematic-debugging,
  verification-before-completion, requesting/receiving-code-review, using-git-worktrees,
  dispatching-parallel-agents, writing-skills. Auto-triggers. Local, no egress.
  Install: `claude plugin install superpowers@superpowers-marketplace`.
- **claude-mem** (thedotmack, Apache-2.0, 84K★, v13.8.1) — persistent episodic memory.
  Auto-captures sessions, AI-compresses, stores LOCAL (SQLite + Chroma at `~/.claude-mem`),
  re-injects relevant context (starts 2nd session per project). Worker on localhost:37701/37777.
  ⚠️ Summarization sends transcript to Anthropic API; Chroma embeddings may hit remote API.
  Wrap secrets in `<private>…</private>`. Layers on top of native memory (both kept).
  Install: `npx claude-mem install` + `npx claude-mem start`.

**Consolidated architecture (one owner per function) — written into CLAUDE.md (project+global):**
CSO=brain (orchestration/state/decisions); superpowers=methodology (TDD/subagent/verify);
gstack=execution tools (/qa,/cso-security,/ship,/canary,/design-review); graphify=recon;
claude-mem=auto episodic memory; cso-learn=curated principles. Don't invoke two owners for
one job; never copy episodic detail into curated memory.

**Meta-lesson:** user was stacking overlapping frameworks (3 wanted methodology, 3 wanted
memory). Resolved by assigning ONE owner per layer rather than running them in parallel.
See [[reference-gstack]], [[feedback-route-new-skills]], [[feedback-framework-sprawl]].
