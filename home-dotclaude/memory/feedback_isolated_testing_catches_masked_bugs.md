---
name: feedback_isolated_testing_catches_masked_bugs
description: "Testing a hook only against the live session's own state can mask bugs that real-world clean sessions would hit — isolate with throwaway repos + temporarily swapped state files"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 3fa6d797-6732-45d9-a3f5-05d144f9d3c8
---

While building a size-based fast path into `.cso/hooks/on-stop-gate.js` (2026-06-30), an
isolated test in a throwaway `/tmp` git repo revealed `if (corrections === 0) return done();`
was an unconditional early return from the entire `main()` function — silently skipping
every gate below it (code-reviewer, release-engineer, test-engineer dispatch checks)
whenever there was no recent "dissatisfied" feedback entry. This had been **inert all
session**: every manual test that day happened to pass because the real session's own
`feedback.jsonl` always had a recent dissatisfied entry during testing (the user had been
giving corrective feedback throughout), which incidentally satisfied the precondition and
masked that the gates below it were unreachable in a clean session.

**Why:** testing a hook by running it against the live, real `.cso/state/*.jsonl` files
only proves it works in *this session's specific state*, not in general. A session with no
detected corrections (i.e. things going smoothly) would have shipped commits with zero
enforcement, and nothing in that day's testing would have caught it, because the test
environment was never actually clean.

**How to apply:** when testing a Stop/PreToolUse/PostToolUse hook that reads shared state
files (`decisions.jsonl`, `feedback.jsonl`, etc.), test in two conditions: (1) against the
real state as a sanity check, and (2) in an isolated throwaway repo/dir with the shared
state files temporarily swapped to a minimal/clean fixture and restored afterward (verify
restoration with `diff` before declaring done — don't just trust the `cp` succeeded). Case
(2) is what actually proves the logic is correct independent of incidental session state.
A passing test against real session data is necessary but not sufficient.

Related: [[feedback_real_review_pattern]], [[feedback_hook_hard_enforcement]].
