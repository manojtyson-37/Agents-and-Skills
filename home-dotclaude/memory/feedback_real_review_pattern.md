---
name: feedback_real_review_pattern
description: "Confirmed pattern that works — every CSO fix this session got dispatched to a real code-reviewer agent before shipping, and it caught real bugs every single time, including in the gate enforcing this exact rule"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 3fa6d797-6732-45d9-a3f5-05d144f9d3c8
---

2026-06-30: built/fixed 5 CSO hook mechanisms in one extended session (Stop-gate
enforcement, dashboard ground-truth, decision-maker PreToolUse gate, transcript-based
dispatch verification, inbox grouping). Every single one went through a real `code-reviewer`
Agent dispatch before commit — not self-grading — and **every single dispatch found a real,
non-cosmetic bug**: an id-namespace conflation inflating a metric, a flat-vs-nested JSON
schema bug that would have made an entire hook a silent no-op, a gameable substring-match
weakness, a title-collision grouping bug that would silently drop tasks from view.

**Why this worked:** the review prompts gave the agent full context (what changed, why,
what was already tested, what to focus on) rather than "review my diff" — see
`[[feedback_real_review_pattern]]` itself for the pattern: state the mechanism, state what
was manually verified already (so the reviewer doesn't waste budget re-checking it), state
the specific failure modes to hunt for. Every review came back with a real verdict
(CHANGES REQUESTED or APPROVE) and concrete severity-tagged findings, never a rubber stamp.

**How to apply:** keep doing this. Before committing any change to `.cso/hooks/*`,
`dashboard/server.js`, or similar shared infrastructure: (1) test manually with constructed
inputs including adversarial cases, (2) dispatch code-reviewer with a context-rich prompt,
(3) actually fix what it finds and re-verify, (4) only then commit. Do not skip step 2 because
the change "looks small" — three of the four bugs found this session were in changes that
looked complete and tested. Don't trust "I tested it" as equivalent to "a second reviewer
checked it" — they catch different failure classes (my manual tests check "does it do what I
intended"; review catches "did I intend the wrong thing").

Also confirmed: when uncertain about an external system's exact contract (e.g. Claude Code's
PreToolUse hook output schema), find a working reference implementation and copy its exact
shape rather than guessing from a partial doc excerpt — the first attempt at the
decision-maker gate still got it wrong (flat fields vs `hookSpecificOutput` nesting) despite
reading the reference, because a doc skim isn't the same as reading the actual working code's
output functions line by line.

Related: [[feedback_hook_hard_enforcement]], [[project_cso_reliability_gaps]].
