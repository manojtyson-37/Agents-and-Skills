---
name: feedback-stop-gate-session-scope
description: Stop gate state-file check must use session-window mtime, not file existence — persistent files make existence-only check always true
metadata:
  type: feedback
---

When fixing stop gate false positives from "no workflow ran this session," the first instinct was `fs.existsSync(wfPath)` as the skip signal. code-reviewer (opus) caught that this is wrong: `workflow_state.json` and `task_history.jsonl` persist across sessions on this machine, so `wfExists` is almost always true. An existence-based skip would let a real workflow session bypass the task_history.jsonl gate whenever workflow_state.json happened to be absent (fresh clone, corrupted state).

Correct signal: `fs.statSync(wfPath).mtimeMs >= sessionStart` — did this file get touched *this session*? If neither state file was touched since session start, no CSO workflow ran and state-file gates don't apply.

**Why:** CSO state files are long-lived. Existence ≠ "created/updated this session." Only mtime relative to `sessionStart` distinguishes conversational sessions from real workflow sessions.

**How to apply:** Any hook gate that checks "did something happen this session" should compare mtime to `sessionStart`, not existence. This applies to workflow_state.json, task_history.jsonl, decisions.jsonl, and any other persistent CSO state file. Don't use existence as a proxy for session activity.

Related: [[feedback_hook_hard_enforcement]]
