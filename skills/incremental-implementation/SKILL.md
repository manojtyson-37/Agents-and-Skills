---
name: incremental-implementation
description: Execute tasks one at a time, test-driven. Use when building features, fixing bugs, or implementing any planned work. Inputs task list; outputs working code with tests.
---

# Incremental Implementation

Execute planned work in small, validated slices. Each task produces tested, working code before moving to the next.

## How It Works

1. **Pick Next Task** — Get highest-priority unblocked task from plan.
2. **Understand Requirements** — Read task description and success criteria.
3. **Write Test First** — Define what passing looks like before writing code.
4. **Implement Code** — Make test pass. Minimal, focused change.
5. **Validate Locally** — Run tests. Check for regressions. Verify against success criterion.
6. **Commit & Document** — One atomic commit per task. Message explains why, not what.
7. **Report Status** — Update task status. Document blockers. Ready for review.

## Usage (Optional)

This is a markdown-only skill. No runnable scripts yet. When invoking this skill:

1. Call with Skill tool: `name: incremental-implementation`
2. Provide: task details from task-breakdown output
3. Skill returns: JSON status with commit hash, tests passing, blockers

Example trigger phrases:
- "Implement task 1"
- "Execute next task"
- "Build this"

## Task Input Format

```json
{
  "task_id": "task-1",
  "title": "Task title",
  "description": "What needs to happen",
  "success_criterion": "How we know it's done",
  "context": "Related files/functions",
  "blockedBy": []
}
```

## Output Format

```json
{
  "task_id": "task-1",
  "status": "completed|blocked|failed",
  "commit_hash": "abc123",
  "files_changed": ["src/file.ts"],
  "tests_added": ["tests/file.test.ts"],
  "tests_passing": 42,
  "blockers": [],
  "notes": "Completed successfully"
}
```

## Present Results to User

1. Task completed: ✅
2. Commit hash and files changed
3. Tests passing (count)
4. Any blockers or next steps
5. Ready for review or next task

## Troubleshooting

**Test won't pass?** Debug before coding more:
- Does test match success criterion?
- Is implementation correct?
- Missing setup/teardown?

**Regressions detected?** Stop. Fix before proceeding.

**Blocker discovered?** Document. Report. Do NOT workaround.

**Task too big?** Break into subtasks. Complete one, commit, reassess.
