---
name: cso-learn
description: >
  Self-learning reflection pass for CSO. Scans the current conversation for user corrections,
  complaints, rejected tool calls, and repeated failures, then saves each lesson as a memory file.
  Use this skill whenever: the user says "learn from this", "save learnings", "reflection pass",
  "cso learn", or invokes /cso-learn. Also auto-invoke at the END of every CSO workflow before
  writing "CSO: Complete." — this is mandatory, not optional. If the user corrected you even once
  during the session, there are learnings to capture. Even if nothing went wrong, check — confirmed
  good approaches are worth saving too (see feedback memory type).
---

# CSO Learning Pass

You are doing a reflection pass over the current conversation. Your goal: extract lessons the user
taught you (explicitly or implicitly) and persist them so future sessions benefit.

## What to look for

Scan the conversation for these signals, ordered by importance:

1. **Explicit corrections** — "that's wrong", "no", "still broken", "I told you", "not what I asked"
2. **Rejected tool calls** — tool uses the user denied or that errored because the approach was wrong
3. **Repeated failures** — same issue fixed 2+ times (indicates the first fix was wrong or verification was bad)
4. **Complaints about process** — "why didn't you check", "you should have", "CSO not working"
5. **Confirmed good approaches** — user said "perfect", "yes exactly", accepted a non-obvious choice without pushback

## How to extract a lesson

For each signal found, ask yourself:

- **What went wrong (or right)?** Be specific — not "verification was bad" but "verified on localhost instead of production URL"
- **Why?** Root cause — not just the symptom
- **How should future sessions behave differently?** Concrete action, not vague advice
- **Is this already saved?** Check existing memory files first — update rather than duplicate

## How to save

### 1. Find the project memory directory

```
# Pattern: ~/.claude/projects/<project-path-with-dashes>/memory/
# Read MEMORY.md to see existing entries
```

### 2. Write a memory file

Filename: `feedback_<topic-slug>.md`

```markdown
---
name: feedback-<topic-slug>
description: <one-line summary — specific enough to judge relevance in future sessions>
metadata:
  type: feedback
---

<The rule itself — what to do or not do>

**Why:** <root cause or user reasoning>

**How to apply:** <when/where this kicks in, concrete actions>
```

### 3. Update MEMORY.md

Add one line per new memory:
```
- [Short title](feedback_<topic-slug>.md) — One-line hook under 150 chars
```

### 4. Log to CSO decisions.jsonl

Append to `/Users/manojaaa/Agents and Skills/.cso/state/decisions.jsonl`:
```json
{"timestamp":"<ISO>","decision":"Learning: <summary>","reason":"<what happened in session>","persona":"orchestrator"}
```

## Rules

- **Don't duplicate.** Read existing memory files first. If a lesson already exists, update it with new context rather than creating a new file.
- **Don't save code patterns.** Memory is for behavioral guidance, not code snippets or architecture decisions derivable from the codebase.
- **Don't save ephemeral context.** "User is working on X right now" doesn't belong — it's stale by next session.
- **Be honest about failures.** If CSO missed something the user caught, say so in the memory. Future sessions need to know what went wrong, not a sanitized version.
- **Confirmed wins matter too.** If the user validated an approach ("yes the single PR was right"), save it — otherwise future sessions might second-guess it.

## Output format

After completing the pass, report:

```
CSO Learning Pass:
- Saved: <N> new lessons, updated <M> existing
- <bullet list of what was saved>
- Skipped: <anything already covered>
```

If nothing new to save: "No new learnings — existing memories cover this session's corrections."
