# Autonomous CSO Architecture

Transform CSO from passive framework (invoke when needed) to autonomous agent (always orchestrating).

## Problem Statement

**Current (Passive):**
```
User starts work
  → Chatbot answers directly
  → User might forget to ask CSO
  → CSO wakes up when explicitly invoked
  → Result: CSO reactive, not proactive
```

**Goal (Autonomous):**
```
User starts work
  → Output intercepted automatically
  → CSO reviews before user sees
  → CSO routes to next persona automatically
  → CSO detects blockers proactively
  → Result: User never manually invokes CSO
```

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Claude Code Session / User Work                            │
└──────────────────────┬──────────────────────────────────────┘
                       │ (all outputs)
                       ▼
         ┌─────────────────────────────┐
         │   Output Interceptor        │
         │  (captures everything)      │
         │  Compress via Headroom      │
         └──────────────┬──────────────┘
                        │ (compressed output + metadata)
                        ▼
      ┌──────────────────────────────────────────┐
      │  Autonomous Orchestrator (Always-On)     │
      │  ├─ Reviews output vs task spec          │
      │  ├─ Detects quality issues               │
      │  ├─ Checks for blockers                  │
      │  └─ Decides: approve / rework / escalate │
      └──────────────┬───────────────────────────┘
                     │ (decision)
         ┌───────────┴───────────┬──────────────┐
         ▼                       ▼              ▼
    ✅ APPROVED         ⚠️ NEEDS REVIEW   🚨 BLOCKED
    (continue)         (route to reviewer) (escalate)
         │                       │              │
         ▼                       ▼              ▼
    ┌──────────────┐   ┌─────────────────┐  ┌──────────┐
    │ Auto-Router  │   │ Notify User     │  │ Escalate │
    │ (next task?) │   │ (show findings) │  │ to User  │
    └──────┬───────┘   └────────┬────────┘  └──────────┘
           │                    │
           ▼                    ▼
      Route to        User reviews,
      next persona    makes decision
      (if ready)            │
           │                ▼
           │          Return to CSO
           │                │
           └────────┬───────┘
                    ▼
            Task Monitor
            (continuous)
              Check status
              Detect delays
              Warn on blockers
                    │
                    ▼
              Back to Orchestrator
```

---

## Components

### 1. Output Interceptor

**Purpose:** Capture all outputs before user sees them.

**Mechanism:**
- Claude Code hook: `onToolOutput`
- Every skill output → interceptor
- Every persona report → interceptor
- Compress via Headroom automatically

**Flow:**
```
Skill produces: 3,200 tokens (task list)
  ↓ (interceptor captures)
Headroom compress: 3,200 → 640 tokens (80%)
  ↓ (passes to orchestrator)
Orchestrator reviews compressed output
```

**Configuration:** `.claude/hooks/on-output.js`

---

### 2. Autonomous Orchestrator

**Purpose:** Always-running coordinator. Reviews outputs, routes work, makes decisions.

**Responsibilities:**
- Review every output against spec
- Detect quality issues
- Spot blockers
- Route to next persona automatically
- Escalate only critical issues

**Decision Logic:**

```
Output received
  ├─ Does it meet success criterion? (YES)
  │   ├─ Any blockers? (NO)
  │   │   ├─ Next task ready? (YES)
  │   │   │   └─ AUTO-ROUTE to next persona
  │   │   └─ (NO) → Approve, wait for dependencies
  │   └─ (YES blockers) → ESCALATE to user
  └─ (NO) → Send back to persona for rework
```

**State:** Tracks task completion, next steps, decisions.

---

### 3. Task Monitor

**Purpose:** Continuous background monitoring.

**Watches:**
- Task status (pending → in-progress → completed)
- Timeline (are we on schedule?)
- Blockers (what's preventing progress?)
- Dependencies (what's waiting on what?)

**Proactive Detection:**

**Example - Blocker Prevention:**
```
Engineer completes task-2
  ↓
Monitor checks: "Is code-reviewer available?"
  ├─ YES: Auto-route to code-reviewer
  └─ NO (busy with other tasks):
      ├─ Queue task-2 for code-reviewer
      ├─ Check: Can any other tasks proceed?
      ├─ Route task-3 to engineer (independent)
      └─ Alert: "Code-reviewer bottleneck forming"
```

---

### 4. Auto-Router

**Purpose:** Route work to right persona without user asking.

**Rules:**

| Condition | Action |
|-----------|--------|
| Engineer completes task → code-reviewer available | Auto-route to code-reviewer |
| Code-reviewer approves → release-engineer ready | Auto-route to release-engineer |
| Test-engineer validates → engineer found rework | Auto-route back to engineer |
| Multiple tasks ready → pick highest priority | Queue them, route in order |
| Blocker detected | Alert orchestrator, hold work |

**Example Workflow (Auto-routed):**
```
Engineer completes task-1 (code)
  ↓ (interceptor captures)
Orchestrator reviews: ✅ meets spec
  ↓ (auto-router decides)
Route to test-engineer immediately
  ├─ Test-engineer notified
  ├─ Task queued
  └─ No user intervention needed
```

---

### 5. State Management

**Purpose:** Persistent workflow state.

**Tracks:**
```json
{
  "objective": "Build CLI todo app",
  "tasks": {
    "task-1": {
      "status": "completed",
      "owner": "engineer",
      "started": "2026-06-23T10:00:00Z",
      "completed": "2026-06-23T10:12:00Z",
      "output": "comp_id_123",
      "issues": []
    },
    "task-2": {
      "status": "in-progress",
      "owner": "test-engineer",
      "routed_at": "2026-06-23T10:12:15Z"
    },
    "task-3": {
      "status": "queued",
      "blocked_by": ["task-2"],
      "owner": "code-reviewer"
    }
  },
  "timeline": {
    "planned": "2.5 hours",
    "elapsed": "15 minutes",
    "status": "on-track"
  },
  "blockers": [],
  "next_action": "Waiting for test-engineer validation"
}
```

**Persistence:** `.cso/workflow_state.json`

Survives session restart. CSO picks up where it left off.

---

### 6. Claude Code Hooks

**Purpose:** Integration with Claude Code lifecycle.

**Hooks Used:**

```bash
# .claude/hooks/

on-output.js           # Intercept all outputs
on-task-complete.js    # Auto-route on completion
on-session-start.js    # Load workflow state
on-session-end.js      # Save workflow state
on-blocker.js          # Alert on blockers detected
```

**Example Hook:**
```javascript
// on-output.js
module.exports = async (output) => {
  // 1. Capture output
  const captured = output;
  
  // 2. Compress via Headroom
  const compressed = await headroom.compress(captured);
  
  // 3. Pass to orchestrator
  const decision = await orchestrator.review(compressed);
  
  // 4. Route based on decision
  if (decision.approve) {
    await autoRouter.routeNext(decision.nextTask);
  } else if (decision.rework) {
    await notifyPersona(decision.persona, decision.issues);
  }
  
  // 5. Return to user (or don't show yet)
  return decision.shouldShow ? output : null;
};
```

---

## Workflow: User's Perspective

**Before (Passive CSO):**
```
1. User: "Build CLI tool"
2. Chatbot: Gives task list
3. User: "Where is CSO?"
4. CSO: "Oh! Let me review..." (reviews task list)
5. User runs tasks manually
6. User: "Is this good?"
7. CSO: "Yes/no..." (reviews again)
8. Result: Lots of manual steps, CSO always catching up
```

**After (Autonomous CSO):**
```
1. User: "Build CLI tool"
2. CSO: Auto-invokes task-breakdown
3. CSO: Reviews task list automatically
4. CSO: "Plan approved. Starting execution."
5. CSO: Auto-invokes engineer with task-1
6. Engineer completes → CSO auto-reviews
7. CSO: Auto-routes to test-engineer
8. Test-engineer completes → CSO auto-routes to code-reviewer
9. Code-reviewer approves → CSO auto-routes to release-engineer
10. Release-engineer ships → CSO: "Workflow complete"
11. Result: Zero manual intervention. CSO orchestrating everything.
```

---

## Decision Points

### When CSO Approves Output
- Output meets success criterion ✅
- No quality issues found ✅
- No blockers ✅
→ Auto-route to next persona

### When CSO Requests Rework
- Output doesn't meet spec ❌
- Quality issues found ❌
→ Route back to persona for fixes

### When CSO Escalates to User
- Critical blocker ❌
- Decision required from user ❌
- Risk threshold exceeded ❌
→ Stop, alert user, wait for input

---

## Benefits

| Aspect | Passive | Autonomous |
|--------|---------|-----------|
| Manual invocation | Every time | Never |
| User attention needed | Constant | Only critical |
| Blocker detection | Reactive | Proactive |
| Work routing | Manual | Automatic |
| Token cost | Higher | Lower (compressed) |
| Productivity | Interrupted | Continuous |

---

## Implementation Notes

- **State persistence:** Workflow state survives restarts
- **Compression:** All outputs compressed before CSO sees (60-95% token savings)
- **Escalation:** Only critical issues bubble up to user
- **Override capability:** User can override CSO decisions if needed
- **Transparency:** CSO logs all decisions (full audit trail)

---

## Next Steps

1. Build output interceptor (Task 32)
2. Build autonomous orchestrator (Task 33)
3. Build task monitor + blocker detector (Task 34)
4. Build auto-router (Task 35)
5. Integrate with hooks (Task 36)
6. Build state management (Task 37)
7. Documentation (Task 38)
8. Validate end-to-end (Task 39)

---

**Status:** Architecture designed. Ready for implementation.
