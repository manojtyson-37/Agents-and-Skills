---
name: cso-global-hooks
description: CSO hooks must work globally across all workspaces — never add workspace guards
metadata: 
  node_type: memory
  type: feedback
  originSessionId: facfa3cd-2762-4467-b784-bdf7042f27d3
---

CSO hooks in ~/.claude/settings.json must fire in ALL workspaces, not just this one.

**Why:** User is building CSO as a universal orchestrator for all tasks across all projects. Scoping hooks to one workspace defeats the purpose.

**How to apply:** Never add CWD/workspace path guards to hook scripts. Hooks use `__dirname`-relative paths for state, so they always write to the central `.cso/state/` regardless of which workspace triggers them. This is intentional — one unified CSO state, one dashboard.
