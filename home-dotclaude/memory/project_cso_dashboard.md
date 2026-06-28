---
name: cso-dashboard-architecture
description: "CSO dashboard setup — ports, state files, hooks pipeline, key technical patterns"
metadata: 
  node_type: memory
  type: project
  originSessionId: facfa3cd-2762-4467-b784-bdf7042f27d3
---

CSO real-time dashboard at `dashboard/` serves on port 3000, auto-refreshes every 2s.

**Why:** Visual orchestration feedback — shows active task, token efficiency, decisions, task history with collapsible workflow groups, and animated hero character.

**How to apply:**
- State files in `.cso/state/`: `workflow_state.json`, `decisions.jsonl`, `task_history.jsonl`, `metrics.json`, `notifications.jsonl`
- Archive dir: `.cso/state/archive/` — completed workflows archived on session start
- Dashboard server: `dashboard/server.js` (Express, APIs at `/api/workflow`, `/api/decisions`, `/api/metrics`, `/api/history`, `/api/notifications`, `/api/archives`)
- Client: `dashboard/public/client.js` — fetches all APIs, renders charts (Chart.js), collapsible task history, hero animation states (idle/flying/done)
- Hooks pipeline: `.cso/hooks/` — `on-user-prompt.js` (bootstraps workflow), `on-tool-output.js` (tracks tokens, makes decisions), `on-session-start.js` (auto-boot dashboard+daemon, archive old workflows), `on-session-end.js`, `on-task-complete.js`
- ESM/CJS fix: `.cso/hooks/package.json` has `"type": "commonjs"` because hooks use `require()` but root has `"type": "module"`
- Hook stdin: Claude Code passes JSON on stdin, not raw text — must parse with `extractPromptText()` to get user message
- Token estimation: ~4 chars/token, 65% compression ratio (0.35 multiplier)

Related: [[cso-global-hooks]]
