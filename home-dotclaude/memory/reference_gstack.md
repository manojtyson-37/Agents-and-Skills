---
name: reference-gstack
description: "gstack (garrytan/gstack, MIT, 117K★) installed non-team at ~/.claude/skills/gstack — virtual eng team slash-commands; complements CSO."
metadata: 
  node_type: memory
  type: reference
  originSessionId: ec6092c0-934c-49c2-82d0-68a49e9ba3f7
---

Installed 2026-06-28, **non-team mode** (no silent auto-update), user-scope at
`~/.claude/skills/gstack`. Prereq bun installed at `~/.bun/bin`. MIT, 117K★, Garry Tan's
Claude Code setup. ~50 slash-command skills.

**Relationship to CSO:** same philosophy (virtual eng team), but gstack is broader/stateless
slash-commands; CSO is the stateful brain (daemon, dashboard, workflow state, decision-maker,
memory). **Keep CSO as orchestrator; use gstack for execution muscle CSO lacked.**

**High-value gstack skills CSO didn't have:**
- `/qa`, `/qa-only`, `/browse` — real headless-browser QA of a URL (great for Silaa staging)
- `/cso` — ⚠️ **Chief *Security* Officer** (OWASP/STRIDE audit). NAME COLLISION: this is NOT
  the Chief-of-Staff CSO. Our CSO is the always-on protocol (no slash command), so typing
  `/cso` triggers gstack's *security* audit. Be aware.
- `/canary`, `/freeze`, `/guard`, `/unfreeze` — rollout safety + edit scoping
- `/autoplan`, `/office-hours`, `/spec`, `/plan-*-review` — planning suite
- `/ship`, `/land-and-deploy`, `/document-release` — release automation
- `/design-review`, `/design-consultation`, `/design-shotgun` — design (beyond ui-ux-pro-max)
- `/investigate`, `/retro`, `/health`, `/context-save`+`/context-restore`, iOS suite

**Overlaps (already have):** `/learn`≈cso-learn, design≈ui-ux-pro-max, team-mode≈bootstrap.

**Risks noted:** team mode = silent hourly auto-update+run from upstream (supply-chain) — we
chose NON-team; upgrade manually via `/gstack-upgrade`. `./setup` runs bash (hygienic: umask 077).

**How to apply:** CSO routes execution tasks to gstack skills — QA→`/qa`, security→`/cso`,
rollout→`/canary`/`/freeze`, design→`/design-review`, release→`/ship`. See
[[project_cso_decision_system]] and [[feedback-safe-tool-trials]].
