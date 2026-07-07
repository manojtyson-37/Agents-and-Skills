---
name: feedback-stop-gate-scope-exemptions
description: "Prod-verify and other deployment gates must not fire for CSO infrastructure commits (.cso/, home-dotclaude/) — these files are never deployed to Vercel"
metadata:
  type: feedback
---

Gate 7 (prod-verify) in `on-stop-gate.js` was firing on hook-only commits because `lastCommitTouchesCode()` correctly returns `true` for `.cso/hooks/*.js` files (they need code-review), but those files are never deployed to Vercel.

Result: every CSO infrastructure commit triggered a prod-verify block demanding a Chrome MCP screenshot of a prod URL — even though no UI change was deployed.

**Fix (commit post-f4a5691):** Added `lastCommitTouchesDeployedAppCode()` — same as `lastCommitTouchesCode()` but also excludes `.cso/` and `home-dotclaude/` paths. Gate 7 uses this function; gate 2 (code-review) still uses `lastCommitTouchesCode()` so hook files still require review.

**Why:** Two separate concerns — "does this need code review?" (yes for hooks) vs "was app code deployed?" (no for hooks). Single function serving both purposes caused false positives.

**How to apply:**
- When adding new gate conditions that involve "was something deployed?": use `lastCommitTouchesDeployedAppCode()` not `lastCommitTouchesCode()`.
- CSO infra paths that are NEVER deployed: `.cso/`, `home-dotclaude/`, `dashboard/` (local only).
- If a commit touches BOTH `.cso/` AND real app code — both gates fire correctly (deployed function still returns true).
- Self-repair rule: if a stop gate blocks on a hook-only commit with no UI change, this is the root cause. Fix by checking which gate function is used.
