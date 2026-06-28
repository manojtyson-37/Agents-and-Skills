---
name: feedback-preview-tool-cwd
description: "preview_start resolves .claude/launch.json relative to the session's original cwd, not the project you're currently working in"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 4b79da6f-21c3-46b4-adfa-4aa72bdcf9a2
---

`preview_start` reads `.claude/launch.json` relative to whatever directory the session started in (e.g. the CSO repo), not the project you `cd`'d into mid-session. Bash's cwd also resets between tool calls — `cd` doesn't persist.

**Why:** Caught building `~/3D Hero Showcase` — called `preview_start` expecting it to launch that project's dev server, but it silently launched the CSO dashboard's `launch.json` config from the original session root instead (different `name`, wrong project entirely).

**How to apply:** When working in a project other than the session's root, don't rely on `preview_start`/`preview_*` tools — they're scoped to session root. Start dev servers manually via `Bash` with `nohup ... &` + `disown`, then drive/verify with the `browse` skill (cwd-agnostic, works against any `localhost:PORT`). Confirmed pattern: `nohup npm run dev -- --port N > /tmp/x.log 2>&1 &`, then `browse goto http://localhost:N`.
