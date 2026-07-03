---
name: feedback-cso-autonomy-preferences
description: "User's explicit CSO autonomy rules — scope/deploy/tech/quality/error-recovery — confirmed 2026-07-03"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 3a28db3c-2282-47f0-b33f-98c4fec8c497
---

User stated these rules explicitly when asked what would make CSO self-sufficient:

1. **Scope ambiguity**: Pick the most sensible default and proceed. Tell the user what was chosen. No upfront clarifying question unless truly blocking.

2. **Deploys**: Verify in staging first. If staging passes, auto-deploy to production — no confirmation prompt needed. Only ask if staging fails and fix path is unclear.

3. **Tech choices**: Pick the best possible solution, not just what's already in the codebase. Hard constraint: must not break existing products. If better approach requires migrating existing code, do the migration as part of the task.

4. **Quality bar**: Full TDD always — tests written first (red), implementation makes them green, code-reviewer agent reviews, all must pass before "done." Smoke-test-only is not acceptable.

5. **Error recovery**: Try up to 3 different fixes autonomously. After 3 failures, stop and surface what was tried + why each failed, then ask user for next-step direction. Do NOT ask on first or second failure.

**Why:** User explicitly asked for CSO to be self-sufficient with minimal interruptions. These rules remove the most common interruption points.

**How to apply:** Before interrupting the user mid-task on any of these 5 classes of decisions, check this list first. Decision-maker subagent should reference these as high-confidence rules.
