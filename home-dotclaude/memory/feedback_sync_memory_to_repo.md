---
name: feedback-sync-memory-to-repo
description: "Memory dir (~/.claude/.../memory) is NOT git-tracked; after saving learnings, sync to home-dotclaude/memory in Agents-and-Skills repo and commit, or they aren't backed up."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: ec6092c0-934c-49c2-82d0-68a49e9ba3f7
---

The live memory dir `~/.claude/projects/-Users-manojaaa-Agents-and-Skills/memory/`
is **not** a git repo — learnings written there exist only on disk. The
Agents-and-Skills repo holds a *vendored copy* at `home-dotclaude/memory/` that goes
stale unless re-synced.

After a session that adds/updates memory files, **sync and commit**:
```
cp ~/.claude/projects/-Users-manojaaa-Agents-and-Skills/memory/*.md \
   "/Users/manojaaa/Agents and Skills/home-dotclaude/memory/"
cd "/Users/manojaaa/Agents and Skills" && git add -A && git commit && git push
```
Run a secret scan on the staged diff first (`git diff --cached | grep -E 'AIza|AQ\.A|key'`).

**Why:** User asked "is git committed with all the learnings?" — they weren't; the
repo was clean but stale. Learnings must be in git to survive and to travel via bootstrap.

**How to apply:** Treat "save a learning" as incomplete until vendored + pushed. Consider
doing the sync as part of the cso-learn / end-of-session flow. See
[[project_cso_decision_system]].

**Recurrence 2026-06-30:** the cwd→projectKey conversion bug (path has a literal space —
"Agents and Skills" — that must become "Agents-and-Skills" to match the real memory dir,
not just slashes→dashes) was independently re-introduced in `.cso/hooks/on-learn-check.js`
and in a brand-new hook `.cso/hooks/on-stop-gate.js` written the same session. Both always
resolved to a nonexistent memory directory and silently returned "no memory update found,"
causing false-positive LEARNING PASS OVERDUE warnings on every prompt. Fixed both to
`cwd.replace(/[\/ ]/g, '-')`. This conversion is duplicated in 2+ files with no shared
helper — if a third hook ever computes a project memory path, copy the fixed regex, don't
re-derive it from `cwd.replace(/\//g, '-')`.
