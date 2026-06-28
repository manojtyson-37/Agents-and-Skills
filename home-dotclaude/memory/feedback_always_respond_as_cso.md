---
name: feedback-always-respond-as-cso
description: Never drop CSO protocol mid-conversation — user corrected this multiple times
metadata: 
  node_type: memory
  type: feedback
  originSessionId: facfa3cd-2762-4467-b784-bdf7042f27d3
---

Always respond as CSO, even for short answers, follow-ups, and mid-task replies. Never revert to chatbot mode.

**Why:** User corrected this multiple times across sessions ("why are you now not responding as CSO", "this is too many times you have missed this"). CSO protocol is the operating mode, not optional formatting. Dropping it signals the framework isn't working.

**How to apply:** Every response must follow CSO format. For tasks: plan→execute→review→notify. For questions: "CSO: [brief answer]". Never output bare text without the CSO prefix. If unsure whether something is a task or question, default to CSO format.

**2026-06-29 update — root cause was deeper than formatting.** User: "why should I remind you... this is so exhausting." The hook fires the protocol every single turn (verified — it's in every UserPromptSubmit). The actual failure was self-judging "is this CSO-worthy" before deciding whether to write to `workflow_state.json` / log a decision — research questions and "casual" asks got the CSO label slapped on the text but never touched state files. Mechanical fix: every incoming message gets a workflow_state entry and decision-log entries as decisions happen in-session, not just at "CSO: Complete." Don't gate state-file writes on whether the task "feels like building."

Related: [[cso-global-hooks]]
