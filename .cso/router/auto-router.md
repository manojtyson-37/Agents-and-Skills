# Auto-Router

Routes work to next persona automatically. No user intervention.

## Purpose

Replace manual routing:
```
BEFORE:
  Task completes
  → User: "What's next?"
  → CSO: "Route to test-engineer"
  → User manually invokes test-engineer

AFTER:
  Task completes
  → Orchestrator approves
  → Auto-router routes automatically
  → Test-engineer immediately notified
  → (User sees notification, nothing to do)
```

## Routing Rules

### Rule 1: Sequential Dependency
```
If: Task X complete + approved
  AND: Task X+1 unblocked
THEN: Auto-route to Task X+1 owner
```

**Example:**
```
Task-1 (engineer) complete → Route to Task-2 (test-engineer)
Task-2 (test-engineer) complete → Route to Task-3 (code-reviewer)
Task-3 (code-reviewer) approved → Route to Task-4 (release-engineer)
```

### Rule 2: Parallel Independence
```
If: Task A complete
  AND: Task B independent of A
  AND: Task B owner available
THEN: Auto-route Task B (in parallel)
```

**Example:**
```
Multiple tasks ready:
  Task-3 (code-reviewer) and Task-5 (ops) are independent
  → Route Task-3 to code-reviewer
  → Also route Task-5 to ops (parallel)
```

### Rule 3: Priority Queuing
```
If: Multiple tasks ready
  AND: Not all personas available
THEN: Queue by priority
  THEN: Route highest priority first
```

**Example:**
```
Both task-2 and task-3 ready, but only one test-engineer
  Task-2: priority=critical
  Task-3: priority=high
  → Route task-2 immediately
  → Queue task-3 (auto-route when test-engineer free)
```

### Rule 4: Blocker Handling
```
If: Task X blocked by Task Y
  AND: Task Y not complete
THEN: Don't route Task X
  AND: Queue for later
  AND: Alert on blockers
```

**Example:**
```
Task-3 (code-reviewer) blocked by Task-2 (test-engineer)
  Task-2 still in progress
  → Hold Task-3
  → When Task-2 complete → auto-route Task-3
```

## Routing Matrix

| Source | Condition | Target | Action |
|--------|-----------|--------|--------|
| Engineer | Task complete + approved | Test-Engineer | Auto-route |
| Test-Engineer | Tests passing + coverage OK | Code-Reviewer | Auto-route |
| Code-Reviewer | Approved | Release-Engineer | Auto-route |
| Release-Engineer | Deployed healthy | Workflow done | Complete |
| Any | Issues found | Rework source | Send back |
| Any | Blocker | Escalate | Alert user |

## Implementation

### Route Next Task (Pseudo-code)

```
function autoRouteNext(completedTask) {
  // 1. Get task workflow
  const workflow = getWorkflow(completedTask.objectiveId);
  
  // 2. Find next task(s)
  const nextTasks = workflow.findNextTasks(completedTask.id);
  
  // 3. For each next task
  for (let nextTask of nextTasks) {
    
    // 4. Check if unblocked
    if (nextTask.isBlocked()) {
      queue(nextTask);
      continue;
    }
    
    // 5. Get target persona
    const targetPersona = getPersona(nextTask.owner);
    
    // 6. Check availability
    if (targetPersona.isAvailable()) {
      // 7. Route immediately
      route(targetPersona, nextTask);
      notify(targetPersona, nextTask);
    } else {
      // 8. Queue if not available
      queue(nextTask);
      checkLater();
    }
  }
  
  // 9. Update state
  updateWorkflowState(workflow);
}
```

## Routing Events

### Route Created
```json
{
  "event": "ROUTE_CREATED",
  "sourceTask": "task-1",
  "sourcePersona": "engineer",
  "targetTask": "task-2",
  "targetPersona": "test-engineer",
  "timestamp": "2026-06-23T10:15:30Z",
  "priority": "high"
}
```

### Route Queued (Waiting)
```json
{
  "event": "ROUTE_QUEUED",
  "targetTask": "task-3",
  "targetPersona": "code-reviewer",
  "reason": "blocked_by_task_2",
  "queuedAt": "2026-06-23T10:20:00Z"
}
```

### Route Executed
```json
{
  "event": "ROUTE_EXECUTED",
  "sourceTask": "task-2",
  "targetTask": "task-3",
  "targetPersona": "code-reviewer",
  "executedAt": "2026-06-23T10:25:00Z"
}
```

## User Notification

When route created, user sees:
```
✅ Task-1 complete (engineer)
→ Auto-routed to: Test-Engineer
  Task-2 starting...
```

When routed:
```
🚀 Task-2 routed to: Test-Engineer
   Input: [compressed output from engineer]
   Waiting for validation...
```

When blocked:
```
⏳ Task-3 queued (waiting for code-reviewer)
   Currently: Code-reviewer on task-2
   ETA: 10 minutes
```

## Edge Cases

### Multiple personas available
```
Route task to: whoever is available first
Queue others
```

### Persona busy
```
Queue task
Check every 5 min if free
Auto-route when available
```

### Task has no next task
```
Mark workflow as: "Awaiting new tasks"
or: "Complete" if all done
```

### Circular dependency (should not happen)
```
Detect during planning
Raise error during task-breakdown
Prevent routing
```

---

**Status:** Auto-router designed. Enables zero-manual-routing workflows.
