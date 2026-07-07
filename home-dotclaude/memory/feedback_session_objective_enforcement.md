---
name: feedback-session-objective-enforcement
description: "Session-start advisory output is insufficient — LLM reads ACTION REQUIRED, acknowledges it, then responds as chatbot. Only a blocking Stop gate enforces session objectives."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: bc181339-b20e-4cf1-a084-d890f33bc0bf
---

User asked "CSO is not running and a lot of things are being missed" — root cause: hooks fire correctly and surface ACTION REQUIRED tasks, but nothing blocks the LLM from ignoring them. Every session, escalated inbox tasks (Silaa ERP 217h stale, brag, perf audit) were surfaced and not actioned. Fixed by adding Gate 0 to on-stop-gate.js: blocks Stop if any escalated inbox task has no decisions.jsonl entry (started or deferred) written this session.

**Why:** Advisory output in system-reminder is read once and forgotten under conversational pressure. The LLM's default is to wait for the user to direct work. Only `{"decision":"block"}` from the Stop hook actually forces action.

**How to apply:**
- Any "must happen this session" requirement needs a blocking gate, not just advisory output.
- The pattern: session-start surfaces → Stop gate enforces end. UserPromptSubmit gate enforces start.
- When adding a new CSO requirement: "what stops this from being silently skipped?" If prose → add a gate.
- Valid exit paths for Gate 0 (Stop): (a) write a plan to workflow_state.json and start, OR (b) log `{"context":"inbox-escalated","workflowId":"<exact>","chosen":"deferred","rationale":"..."}` to decisions.jsonl.
- UserPromptSubmit activation gate (2026-07-07): first turn blocks if workflow in-progress and no resume phrase. Resume phrases: "CSO go/start/continue/resume", "continue", "proceed", "go ahead", "start now", "let's go". Fires once per session (marker in .protocol-shown/<sessionId>-cso-activated).
- The full enforcement chain: session-start surfaces → UserPromptSubmit blocks first turn (start) → Stop gate blocks session end (end). Advisory text alone = zero compliance.

Related: [[feedback_hook_hard_enforcement]], [[feedback_cso_self_repair_design]]
