# CSO Dashboard

Real-time visualization of Chief of Staff workflow orchestration.

## What it shows

- **Workflow State** — Current objective, elapsed time, task count
- **Task Timeline** — Completed ✅ | In-Progress ⚙️ | Queued ⏳ | Blocked 🔴
- **Performance Metrics** — Token compression %, tasks completed, decisions made
- **Decision Log** — All CSO decisions (approve/rework/escalate) with reasoning
- **Auto-refresh** — Updates every 2 seconds, polls CSO state files

## Start Dashboard

```bash
cd dashboard
npm start
```

Open: `http://localhost:3000`

## How it works

**Backend** (server.js):
- Express server on port 3000
- Reads CSO state files: `../.cso/state/`
- REST APIs:
  - `/api/workflow` — Current workflow state
  - `/api/decisions` — Decision history
  - `/api/metrics` — Performance metrics
  - `/api/history` — Task history

**Frontend** (public/):
- Single-page app with auto-refresh
- Fetches every 2s
- Renders workflow, tasks, decisions, metrics
- Real-time updates as CSO works

## CSO Integration

Dashboard watches CSO state files:
- `workflow_state.json` — Workflow objective, tasks, status
- `decisions.jsonl` — Decision log (one JSON per line)
- `task_history.jsonl` — Task events (started, completed)
- `metrics.json` — Token savings, compression %

CSO writes state → Dashboard reads → Real-time visualization.

## Files

- `server.js` — Express API server
- `public/index.html` — Dashboard UI
- `public/styles.css` — Dark theme styling
- `public/client.js` — Auto-refresh logic
- `package.json` — Dependencies (express, cors)
