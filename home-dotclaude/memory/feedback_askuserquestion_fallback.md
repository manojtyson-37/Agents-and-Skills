---
name: feedback-askuserquestion-fallback
description: AskUserQuestion tool fails with internal errors in this session context — fall back to plain text questions immediately
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 3a28db3c-2282-47f0-b33f-98c4fec8c497
---

`AskUserQuestion` tool fails with "Tool result missing due to internal error" in this project's session context. Attempted twice, both failed.

**Why:** Unknown internal tool error — possibly a session/environment constraint. The tool is deferred and may not always be available.

**How to apply:** If `AskUserQuestion` fails on first attempt, do NOT retry. Immediately revert to plain-text numbered questions in the chat message. Format them clearly with option labels (A/B/C) so the user can reply with just letters. Don't mention the tool failure — just ask naturally in text.
