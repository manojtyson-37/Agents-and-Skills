# Claude Code Hooks Setup

Integration points that make CSO autonomous within Claude Code.

## Hooks Configuration

Add to `.claude/settings.json`:

```json
{
  "hooks": {
    "onSessionStart": ".cso/hooks/on-session-start.js",
    "onToolOutput": ".cso/hooks/on-tool-output.js",
    "onTaskComplete": ".cso/hooks/on-task-complete.js",
    "onError": ".cso/hooks/on-error.js",
    "onSessionEnd": ".cso/hooks/on-session-end.js"
  },
  "csoAutonomous": {
    "enabled": true,
    "interceptAll": true,
    "autoRoute": true,
    "proactiveMonitor": true
  }
}
```

## Hooks

### 1. onSessionStart

**Trigger:** When Claude Code session starts

**Action:**
```javascript
// Load workflow state from previous session
// Initialize interceptor
// Start task monitor
// Check for in-progress tasks
// Resume if workflow ongoing
```

**Example:**
```
Session starts
  ↓
Load: workflow_state.json (previous session)
  ├─ Task-2 was in-progress (test-engineer)
  ├─ Task-3 queued
  └─ Elapsed: 15 minutes since last session
  
Resume: Task-2 still running
  └─ Monitor continues where it left off
  
User sees: "Resuming previous workflow. Task-2 in-progress..."
```

### 2. onToolOutput

**Trigger:** Every skill/persona output

**Action:**
```javascript
// 1. Capture output
// 2. Compress via Headroom
// 3. Pass to orchestrator
// 4. Orchestrator decides: approve/rework/escalate
// 5. Execute decision (auto-route if approved)
```

**Example:**
```
Engineer completes task-1
  ↓
Hook triggered: onToolOutput
  ├─ Capture engineer output
  ├─ Compress (1,200 → 264 tokens)
  ├─ Orchestrator reviews
  ├─ Decision: APPROVE + auto-route
  └─ Route to test-engineer immediately
```

### 3. onTaskComplete

**Trigger:** When task marked complete

**Action:**
```javascript
// 1. Verify completion against success criterion
// 2. Update workflow state
// 3. Check if any new tasks ready
// 4. Trigger task monitor to check blockers
// 5. Auto-route next task if ready
```

**Example:**
```
Test-engineer marks task-2 complete
  ↓
Hook triggered: onTaskComplete
  ├─ Success criterion: "Tests passing: 20/20" ✅
  ├─ Update state: task-2 → "completed"
  ├─ Check: task-3 ready? ✅ (code-reviewer available)
  ├─ Monitor checks: any blockers? ✅ NONE
  └─ Auto-route task-3 to code-reviewer
```

### 4. onError

**Trigger:** When error occurs in workflow

**Action:**
```javascript
// 1. Catch error from persona/skill
// 2. Log for audit trail
// 3. Notify orchestrator
// 4. Decide: retry / escalate / rework
```

**Example:**
```
Engineer hits error: "Failed to install dependencies"
  ↓
Hook triggered: onError
  ├─ Log error: "npm install failed - network timeout"
  ├─ Notify orchestrator
  ├─ Orchestrator decides: Retry (network temporary)
  └─ Auto-retry in 30 seconds
```

### 5. onSessionEnd

**Trigger:** When Claude Code session ends

**Action:**
```javascript
// 1. Save workflow state to disk
// 2. Record all decisions made
// 3. Compress and archive logs
// 4. Calculate session metrics
// 5. Prepare for resume in next session
```

**Example:**
```
Session ends at 17:00
  ↓
Hook triggered: onSessionEnd
  ├─ Save state: workflow_state.json
  ├─ Archive: all logs, decisions, outputs
  ├─ Compress: 80% savings recorded
  ├─ Metrics:
  │   Total tasks: 5
  │   Completed: 3
  │   In-progress: task-2 (test-engineer)
  │   Next: task-3 (code-reviewer)
  │   Estimate remaining: 45 min
  └─ Save resumable state
  
Next session: "Resume from task-2"
```

## Hook Files

### on-session-start.js

```javascript
module.exports = async () => {
  console.log('[CSO] Session starting...');
  
  // Load workflow state
  const fs = require('fs');
  const stateFile = '.cso/state/workflow_state.json';
  
  if (fs.existsSync(stateFile)) {
    const state = JSON.parse(fs.readFileSync(stateFile));
    console.log(`[CSO] Resuming workflow: ${state.objective}`);
    console.log(`[CSO] In-progress: ${state.inProgressTask}`);
    
    // Start monitor
    startTaskMonitor();
    
    // Resume orchestrator
    resumeOrchestrator(state);
  } else {
    console.log('[CSO] New workflow. Ready for task.');
  }
};
```

### on-tool-output.js

```javascript
const Headroom = require('headroom-ai');
const Orchestrator = require('../orchestrator/orchestrator.js');

module.exports = async (output, context) => {
  console.log(`[CSO] Intercepted: ${context.sourceName}`);
  
  // Compress
  const compressed = await Headroom.compress(output, {
    contentType: context.contentType || 'auto'
  });
  
  // Review
  const decision = await Orchestrator.review(compressed, context);
  
  // Route
  if (decision.action === 'APPROVE') {
    if (decision.nextTask) {
      console.log(`[CSO] → Auto-routing: ${decision.nextTask}`);
      return await autoRoute(decision.nextTask);
    }
  } else if (decision.action === 'REWORK') {
    console.log(`[CSO] 🔄 Rework needed: ${decision.issues.join(', ')}`);
    return await sendBack(decision);
  }
};
```

### on-task-complete.js

```javascript
const StateManager = require('../state/state-manager.js');
const TaskMonitor = require('../monitor/task-monitor.js');

module.exports = async (taskId) => {
  console.log(`[CSO] Task complete: ${taskId}`);
  
  // Update state
  await StateManager.markComplete(taskId);
  
  // Check next tasks
  const nextTasks = await StateManager.getNextTasks(taskId);
  
  // Monitor for blockers
  for (let task of nextTasks) {
    if (!task.isBlocked()) {
      console.log(`[CSO] → Auto-routing: ${task.id}`);
      await autoRoute(task);
    }
  }
};
```

## Hook Execution Order

```
Session starts
  ↓ onSessionStart
Load state, start monitor

User invokes skill
  ↓ onToolOutput
Capture → Compress → Review → Route

Persona completes task
  ↓ onTaskComplete
Verify → Update state → Check next → Route

Error in workflow
  ↓ onError
Log → Notify → Decide → Retry/Escalate

Session ends
  ↓ onSessionEnd
Save state → Archive logs → Calculate metrics
```

## Monitoring Integration

Hooks work with task monitor:

```
Monitor running continuously (every 5-10 sec)
  ├─ Check task status
  ├─ Detect overruns
  ├─ Spot blockers
  └─ Trigger actions
  
Hook triggered: onTaskComplete
  ├─ Monitor checks: are conditions met?
  ├─ Monitor checks: route next task?
  └─ If yes: execute route
```

## User-Facing Output

Hooks only show critical information:

```
✅ Task-1 complete (engineer)
   Compressed: 1,200 → 264 tokens (78% saved)
   
→ Auto-routed to: Test-Engineer
   Starting validation...

⏳ Monitor: Task-2 slightly overrunning (+10%)
   Will finish in ~5 minutes
   
✅ Task-2 complete (test-engineer)
   
→ Auto-routed to: Code-Reviewer
```

---

**Status:** Hooks designed. Enable full CSO integration with Claude Code.
