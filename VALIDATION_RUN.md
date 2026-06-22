# Skill Invocation Validation

## Test Scenario

**Skill:** `task-breakdown`

**Input:**
```json
{
  "objective": "Build a CLI todo app with add/list/delete commands",
  "constraints": [
    "Node.js only",
    "Persist to JSON file",
    "< 3 hours total"
  ],
  "risks": [
    "File locking issues under concurrent access - use locking mechanism",
    "Complex command parsing - use yargs library"
  ]
}
```

## Actual Output (Following SKILL.md Format)

```json
{
  "objective": "Build a CLI todo app with add/list/delete commands",
  "constraints": [
    "Node.js only",
    "Persist to JSON file",
    "< 3 hours total"
  ],
  "risks": [
    "File locking issues under concurrent access - use locking mechanism",
    "Complex command parsing - use yargs library"
  ],
  "tasks": [
    {
      "id": "task-1",
      "title": "Project setup",
      "description": "Init Node project, install yargs and file-locking dependencies",
      "owner": "builder",
      "estimate": "0.25",
      "success_criterion": "package.json exists, yargs and proper-lockfile installed, project structure ready",
      "blockedBy": [],
      "priority": "critical"
    },
    {
      "id": "task-2",
      "title": "Implement add command",
      "description": "Create todo item with title, timestamp. Persist to todos.json with file locking",
      "owner": "builder",
      "estimate": "0.75",
      "success_criterion": "Command 'todo add \"task name\"' creates entry in todos.json, test passes",
      "blockedBy": ["task-1"],
      "priority": "critical"
    },
    {
      "id": "task-3",
      "title": "Implement list command",
      "description": "Read todos.json, format output as table with ID, title, timestamp",
      "owner": "builder",
      "estimate": "0.5",
      "success_criterion": "Command 'todo list' shows all todos formatted, test passes",
      "blockedBy": ["task-2"],
      "priority": "high"
    },
    {
      "id": "task-4",
      "title": "Implement delete command",
      "description": "Remove todo by ID from todos.json with proper locking",
      "owner": "builder",
      "estimate": "0.5",
      "success_criterion": "Command 'todo delete <id>' removes item, test passes",
      "blockedBy": ["task-3"],
      "priority": "high"
    },
    {
      "id": "task-5",
      "title": "Write integration tests",
      "description": "Test full workflow: add -> list -> delete. Verify state persistence",
      "owner": "builder",
      "estimate": "0.5",
      "success_criterion": "All tests pass, 85%+ code coverage, edge cases handled",
      "blockedBy": ["task-4"],
      "priority": "high"
    }
  ],
  "dependencies": ["yargs", "proper-lockfile"],
  "total_estimate": "2.75",
  "critical_path": ["task-1", "task-2", "task-3", "task-4", "task-5"]
}
```

## Validation Checklist

- [x] Input format matches SKILL.md expectation
- [x] Output format matches SKILL.md Output Format section
- [x] JSON is valid, parseable
- [x] Tasks are atomic (fit in one work session)
- [x] Tasks sequenced with correct dependencies
- [x] Success criteria are testable
- [x] Estimate totals to < 3 hours (matches constraint)
- [x] blockedBy relationships create valid DAG (no cycles)
- [x] Risks acknowledged and mitigation present

## Result

✅ **PASS** — Skill output format validated. Ready for incremental-implementation skill.
