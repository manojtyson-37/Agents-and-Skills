---
name: feedback-analyzer-false-positives
description: "on-user-feedback.js was classifying <task-notification> XML blobs as user dissatisfaction, generating bogus self-repair tasks and inflating the feedback.jsonl dissatisfied count"
metadata:
  type: feedback
---

`on-user-feedback.js` runs on every UserPromptSubmit event. When an agent task completes, Claude Code delivers the result as a `<task-notification>...</task-notification>` XML blob in the next user turn. The hook was passing this through `analyzeSentiment()` — and the XML content contains words like "failed", "error", "issue", "wrong" in task output text, which matched broad dissatisfaction patterns like `/failed/i`, `/issue/i`, `/wrong/i`.

Result: feedback.jsonl accumulated "dissatisfied" entries from internal tool results, not real user complaints. The self-repair daemon read these and queued bogus repair tasks (performance, data-quality categories). The stop gate then blocked session end demanding these tasks be addressed — all for a false signal.

**Why:** `extractPromptText()` correctly extracts the text, but `<task-notification>` XML passes the `length < 10` guard (it's long) and reaches `analyzeSentiment()`. No guard existed to distinguish user text from tool result XML.

**Fixed (commit 6558505):**
- Guard: skip inputs matching `^<task-notification|task-result|tool-result>`
- Guard: skip inputs where XML tag chars > 40% of `input.length` (use full length, not sample length — code-reviewer caught denominator bug)
- Patterns tightened: removed `/bad/i`, `/can't/i`, `/issue/i`, `/problem/i` standalone; added word boundaries + context requirements

**How to apply:**
- If feedback.jsonl shows many "dissatisfied" entries with `excerpt: "<task-notification>..."` — these are false positives from the old code. Check the commit date; entries before 2026-07-08 may be noise.
- Never classify input as user feedback without first checking it isn't a system/tool XML blob.
- When tightening sentiment patterns: test against known real complaints ("team is not happy", "It failed", "not working") AND check for false positives on task-notification content.

Related: [[feedback_cso_self_repair_design]], [[feedback_gate_implementation_quality]]
