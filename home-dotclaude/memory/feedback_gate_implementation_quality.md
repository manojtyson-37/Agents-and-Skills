---
name: feedback-gate-implementation-quality
description: Stop gates written quickly contain subtle bugs that make them gameable or incorrect — code-reviewer always finds real blockers in hook code; never self-review infra files.
metadata: 
  node_type: memory
  type: feedback
  originSessionId: bc181339-b20e-4cf1-a084-d890f33bc0bf
---

Gate 0 written in this session had 2 blockers found by code-reviewer:
1. `Date.parse(e.timestamp || 0)` → `Date.parse("0")` returns NaN on V8, meaning entries with missing timestamps were treated as in-window (bypassed the time filter entirely). Fix: `e.timestamp ? Date.parse(e.timestamp) : 0`.
2. 30-char objective substring match on the full serialized JSON blob — any two objectives with a common prefix (e.g. "Fix dashboard auth" / "Fix dashboard layout") would cross-clear each other. Fix: require structured `workflowId` field match; objective fallback only for strings ≥40 chars.

These are exactly the class of bugs (off-by-one logic, gameable substring match, NaN propagation) that appear in quickly-written Node.js hook code and that self-review consistently misses.

**Why:** Hook code is infrastructure — a wrong gate silently stops enforcing anything (or blocks incorrectly). The cost of a bug here is high and invisible. Every "small-looking" infra diff this project has had contained a real bug a full dispatch caught.

**How to apply:**
- `.cso/hooks/*.js` files always require full code-reviewer dispatch, never self-review. This is already in on-stop-gate.js `touchesReviewExemptInfra()` — don't change it.
- When writing gate logic involving timestamp comparison: always use ternary fallback, never `||` with non-string values.
- Substring matching on serialized JSON is fragile. Prefer structured field checks (`e.fieldName === value`); use substring only as explicit named fallback with length guard.

Related: [[feedback_hook_hard_enforcement]], [[feedback-stop-gate-session-scope]]
