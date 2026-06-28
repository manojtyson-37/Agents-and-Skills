---
name: feedback-safe-tool-trials
description: "When trialing a tool that reads/indexes a codebase, default to keyless/zero-egress first, verify no secret leak, gitignore artifacts, flag installer side-effects."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: ec6092c0-934c-49c2-82d0-68a49e9ba3f7
---

When trial-installing any tool that ingests or indexes a codebase (graph builders,
indexers, RAG tools):

1. **Keyless / zero-egress first.** Run the mode that needs no API key so nothing
   leaves the machine, before any LLM/cloud pass. Prove value locally first.
2. **Secret-leak check.** After it builds artifacts, grep the output for `.env`
   values and known secrets — confirm 0 leaks before trusting it on private code.
3. **Gitignore the output.** Build artifacts (e.g. `graphify-out/`) are large and
   may be sensitive — add to the target repo's `.gitignore`.
4. **Flag installer side-effects.** Note when an installer rewrites the repo's
   `CLAUDE.md`, `.claude/settings.json` hooks, or git hooks — these change assistant
   behavior and the user should know.
5. **Scope first, global later.** Install project-scoped; only roll out globally
   after the trial produces valid data. (User's explicit preference.)

**Why:** User's pattern — "trial project-scoped, get valid data, then go global" — plus
his security-consciousness about private code/secrets.

**How to apply:** Any "install/try this tool" task. Validated on the graphify trial
(2026-06-28). See [[reference-codebase-graph-tools]] and [[feedback_public_repo_secret_handling]].
