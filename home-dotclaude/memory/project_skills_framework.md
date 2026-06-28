---
name: project-skills-framework
description: "This workspace is the CSO factory — build here, deploy everywhere via global hooks + CLAUDE.md"
metadata: 
  node_type: memory
  type: project
  originSessionId: facfa3cd-2762-4467-b784-bdf7042f27d3
---

The "Agents and Skills" workspace is the **factory** for CSO. Everything built here deploys globally via `~/.claude/CLAUDE.md` and `~/.claude/settings.json` hooks.

**Why:** User explicitly stated: "We are building CSO and agents in this workspace folder which will be used in other sessions and other applications."

**How to apply:** When working in this workspace, treat changes as infrastructure — they affect all workspaces. Test cross-workspace behavior. When building features, ask: "will this work from a different CWD?" State paths must be absolute. Skills/hooks must be workspace-agnostic. User does NOT do standups — skip daily standup proposals. Focus scheduled agents on PR watchdog and automated monitoring, not ceremony.

Related: [[cso-global-hooks]]
