# Task Monitor + Blocker Detector

Continuous background monitoring. Proactive blocker detection. Never let user hit a problem unseen.

## Purpose

```
BEFORE: User discovers blocker → slow down → ask CSO → CSO fixes
AFTER: CSO detects blocker coming → routes around it → user never hits it
```

## Monitoring Loop

Runs continuously (every 5-10 seconds):

```
Check workflow state
  ├─ Any tasks in-progress?
  │   ├─ Taking longer than estimate?
  │   │   └─ Alert: "Task X overrunning estimate"
  │   └─ Blocked by dependencies?
  │       └─ Alert: "Task X waiting on Task Y"
  │
  ├─ Any tasks queued?
  │   ├─ Waiting for persona?
  │   │   └─ Check: Can other personas work in parallel?
  │   │       └─ Route independent tasks immediately
  │   └─ Waiting for dependencies?
  │       └─ Check: When will dependency finish?
  │
  └─ Any personas idle?
      └─ Check: Any queued tasks?
          └─ Route immediately to idle persona
```

## Blocker Detection Rules

### Rule 1: Timeline Overrun
```
If: Task in-progress > (estimate + 50%)
THEN: Alert CSO
  Message: "Task X taking longer than planned"
  Check: Is persona stuck?
  Action: Can CSO help? Can other persona take over?
```

**Example:**
```
Task-1 estimate: 0.25 hours (15 min)
Task-1 running: 25 minutes (over by 10 min)
→ Alert: "Engineer slower than expected on task-1"
→ Check: Any bottlenecks?
→ Offer: Route next task to different persona?
```

### Rule 2: Dependency Blocker
```
If: Task X blocked by Task Y
  AND: Task Y not complete
  AND: Task Y taking longer than estimate
THEN: Alert CSO
  Message: "Task X blocked by Task Y (overrunning)"
  Estimate: When will Task Y finish?
  Action: Can Task X be parallelized with something else?
```

**Example:**
```
Task-2 (test-engineer) blocked by Task-1 (engineer)
Task-1 taking 25 min (estimate: 15 min)
→ Alert: "Task-2 waiting on Task-1 (10 min overrun)"
→ Check: Are there other tasks test-engineer can start?
→ Route independent task to test-engineer?
```

### Rule 3: Persona Bottleneck
```
If: Multiple tasks queued for same persona
  AND: Persona busy with one task
  AND: Other personas idle
THEN: Check if other personas can help
  AND: Redistribute work if possible
```

**Example:**
```
Queue:
  Task-2 (code-reviewer) - waiting
  Task-3 (code-reviewer) - waiting
Code-reviewer busy with Task-1

Idle:
  Test-engineer free
  
Check: Can test-engineer help with review?
→ If YES: Distribute Task-2 to test-engineer
→ Reduce bottleneck
```

### Rule 4: Critical Path Delay
```
If: Task on critical path overrunning
THEN: Alert immediately
  Message: "Critical path delay detected"
  Impact: Final completion time at risk
  Action: Escalate to user (might need help)
```

**Example:**
```
Critical path: Task-1 → Task-2 → Task-3 → Task-4
Task-2 (on critical path) taking 45 min (estimate: 30 min)
→ Alert: "Critical path at risk"
→ Impact: Final delivery might slip 15 min
→ Check: Can CSO help Task-2?
→ Escalate if can't mitigate
```

## Proactive Actions

When blocker detected, CSO doesn't just alert. It acts:

### Action 1: Re-Route Independent Work
```
Detected: Engineer blocked on code-reviewer feedback
Available: Test-engineer idle
Action: Route independent testing to test-engineer
Result: Parallelism increases, doesn't wait for approval
```

### Action 2: Prioritize High-Impact Tasks
```
Detected: Multiple tasks queued
Available: One persona
Action: Route highest-priority first
Result: Critical path moves, less important tasks wait
```

### Action 3: Escalate for User Input
```
Detected: Critical blocker (e.g., data migration risk)
Action: Alert user with context
Wait: User decision
Result: Unblock when user provides direction
```

### Action 4: Suggest Parallelization
```
Detected: Sequential tasks that could be parallel
Action: Suggest to orchestrator
Result: Run in parallel if safe, save time
```

## Monitoring State

Track for each task:

```json
{
  "taskId": "task-1",
  "status": "in-progress",
  "owner": "engineer",
  "startedAt": "2026-06-23T10:00:00Z",
  "estimatedDuration": "0.25 hours",
  "elapsedTime": "0.42 hours",
  "overrunPercent": 68,
  "blockedBy": [],
  "blockers": [],
  "healthCheck": {
    "onTrack": false,
    "alert": "Overrunning estimate by 68%",
    "severityOverride": 25,
    "action": "Check for blocker, offer help"
  }
}
```

## Alert Levels

| Level | Trigger | Action |
|-------|---------|--------|
| **GREEN** | On schedule, no blockers | Continue |
| **YELLOW** | Slight overrun (10-50%) | Monitor, check for help needed |
| **RED** | Serious overrun (50%+) | Alert, offer intervention |
| **CRITICAL** | Critical path delay | Escalate to user |

## Continuous Monitoring Output

```
[MONITOR] 10:05:00 Task-1 (engineer) - GREEN (2 min left)
[MONITOR] 10:10:00 Task-1 complete ✅
[MONITOR] 10:10:05 Task-2 routed to test-engineer
[MONITOR] 10:15:00 Task-2 (test-engineer) - YELLOW (12 min overrun)
  → Check: Need help?
  → Offer: Route Task-3 to code-reviewer (independent)?
[MONITOR] 10:15:30 Task-3 routed to code-reviewer (parallel)
[MONITOR] 10:20:00 Task-2 complete ✅
[MONITOR] 10:22:00 Task-3 (code-reviewer) - RED (18 min overrun)
  → Action: Escalate to user
  Message: "Code-reviewer taking longer. Review findings available at comp_id_456"
```

## Integration with Orchestrator

Monitor feeds data back to orchestrator:

```
Monitor: "Task-2 overrunning"
  ↓
Orchestrator: Check Task-2 output so far
  ├─ If found issue → Help rework
  ├─ If not issue → Continue monitoring
  └─ If blocked → Escalate

Monitor: "Code-reviewer has queue of 3 tasks"
  ↓
Orchestrator: Check if any other personas can help review
  ├─ Test-engineer free? → Route Task-1 to test-engineer
  └─ Ops persona? → Route Task-2 to ops (if capable)
```

## Preventing Bottlenecks

Monitor predicts bottlenecks:

```
Current state:
  Engineer: free
  Test-engineer: free
  Code-reviewer: busy (Task-1, Task-2 queued)
  
Prediction:
  → Code-reviewer bottleneck forming
  → 2 tasks waiting, code-reviewer busy for 20 min
  
Action:
  → Route queued Task-2 to test-engineer?
  → Route independent Task-3 to engineer?
  → Parallelize to reduce wait
```

---

**Status:** Task monitor designed. Enables proactive orchestration.
