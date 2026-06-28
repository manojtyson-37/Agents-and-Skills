---
name: feedback-route-new-skills
description: "Installing a skill ≠ CSO auto-using it. Must add it to the Skill Routing table in CLAUDE.md (project + global) or CSO won't reach for it."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: ec6092c0-934c-49c2-82d0-68a49e9ba3f7
---

For CSO to auto-invoke a tool **without the user naming it**, two layers are required:
1. **Discovery** — skill installed in `~/.claude/skills/` (Claude Code finds it). Necessary but NOT sufficient.
2. **Routing** — an entry in the **Skill Routing / External Tool Routing table** in `CLAUDE.md`
   (both project `/Users/manojaaa/Agents and Skills/CLAUDE.md` AND global `~/.claude/CLAUDE.md`),
   mapping persona/task-type → tool + when. CSO reads this table each session and invokes by match.

Whenever a new skill/tool is installed (gstack, graphify, future ones), **add a routing-table row**
or CSO will only use it if the model happens to remember — not deterministic.

Caveats: CSO routes in reaction to a user *task* (it picks the tool, user needn't name it); it does
not act with zero input. CLAUDE.md loads at session start, so routing edits are fully live next session.

**Why:** User asked "can CSO pick these up without me saying?" — answer was no until gstack/graphify
were added to the routing map (commit a67c93e, 2026-06-28).

**How to apply:** After any skill install, update the routing table + resync `home-dotclaude/CLAUDE.md`
+ commit. See [[reference-gstack]], [[reference-codebase-graph-tools]], [[feedback-sync-memory-to-repo]].
