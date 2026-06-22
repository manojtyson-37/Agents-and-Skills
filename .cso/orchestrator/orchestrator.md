# Autonomous Orchestrator

Always-on coordinator. Reviews every output. Makes decisions automatically.

## Core Logic

```
Output received (compressed)
  ├─ [VALIDATE] Does it meet success criterion?
  │   ├─ YES → [CHECK BLOCKERS]
  │   │   ├─ None → [APPROVE]
  │   │   └─ Found → [ESCALATE]
  │   └─ NO → [REWORK]
  └─ [ROUTE] Any quality issues?
      ├─ Critical → [ESCALATE]
      └─ None → [APPROVE + ROUTE NEXT]
```

## Decision Rules

### 1. APPROVE Decision
**Criteria:**
- ✅ Meets success criterion
- ✅ No quality issues
- ✅ No blockers
- ✅ No security concerns

**Action:**
- Approve output
- Check if auto-routing needed
- Update workflow state

**Example:**
```
Engineer task-1 complete
  Success criterion: "Package.json exists, deps installed"
  Check: ✅ Yes
  Issues: None
  Blockers: None
  → APPROVE + auto-route to test-engineer
```

### 2. REWORK Decision
**Criteria:**
- ❌ Doesn't meet success criterion
- ❌ Quality issues found
- ❌ Incomplete output

**Action:**
- List specific issues
- Suggest fixes
- Route back to source persona
- Wait for rework

**Example:**
```
Code-reviewer task findings
  Issues: [HIGH] Missing null check, [MEDIUM] Error messages unclear
  → REWORK: Route back to engineer with specific issues
```

### 3. ESCALATE Decision
**Criteria:**
- 🚨 Critical blocker found
- 🚨 Security/data risk
- 🚨 Decision needed from user
- 🚨 Multiple rework iterations (2+)

**Action:**
- Alert user with reason
- Provide context
- Wait for user decision
- Don't proceed until resolved

**Example:**
```
Release-engineer deployment failed
  Error: "Database migration would break existing data"
  → ESCALATE: Need user decision on migration strategy
```

## Quality Checks

For each output, orchestrator checks:

### Correctness Check
- Does output match task requirements?
- Are success criteria met?
- Any obvious errors?

**Example:**
```
Engineer output: "Tests passing: 47/47"
Success criterion: "All tests passing"
Check: ✅ Met
```

### Completeness Check
- Is output complete?
- Any missing pieces?
- Any TODOs left in?

**Example:**
```
Code output includes:
  ✅ Implementation
  ✅ Tests
  ✅ Commit message
  → Complete
```

### Quality Check
- Code style consistent?
- Best practices followed?
- Documentation adequate?

**Example:**
```
Code review findings:
  Issues: [MEDIUM] Inconsistent naming
  But: Not critical
  → APPROVE (non-blocking)
```

### Blocker Check
- Any blockers preventing next step?
- Dependencies met?
- External resources ready?

**Example:**
```
Test-engineer task blocked:
  Reason: "Code-reviewer still reviewing task-1"
  → Hold task-2, check dependencies
```

## Auto-Routing Logic

Once approved, orchestrator decides: route next task?

```
Task approved
  ├─ Is there a next task? 
  │   ├─ YES → Is it unblocked?
  │   │   ├─ YES → Auto-route
  │   │   └─ NO → Queue it
  │   └─ NO → All tasks complete? → Mark workflow done
```

**Example workflow (auto-routed):**
```
Task 1: Engineer completes
  → Approved
  → Task 2: Test-engineer queued
  → Auto-route to test-engineer
  
Task 2: Test-engineer completes
  → Approved
  → Task 3: Code-reviewer queued
  → Auto-route to code-reviewer
  
Task 3: Code-reviewer approves
  → Approved
  → Task 4: Release-engineer queued
  → Auto-route to release-engineer
  
(No manual routing needed. All automatic.)
```

## State Updates

Every decision updates workflow state:

```json
{
  "output_id": "comp_eng_task1_001",
  "source": "engineer",
  "task": "task-1",
  "decision": "APPROVE",
  "nextTask": "task-2",
  "nextPersona": "test-engineer",
  "timestamp": "2026-06-23T10:15:30Z",
  "savedTokens": 2856
}
```

## Escalation Criteria

Escalate to user if:

1. **Critical Bug** - Output has critical issues
2. **Security Risk** - Data/security concern
3. **Blocker** - External decision needed
4. **Rework Loop** - Same task reworked 2+ times
5. **Risk Threshold** - Risk exceeds acceptable level

## Monitoring

Orchestrator logs all decisions:

```
[ORCHESTRATOR] ✅ APPROVE: engineer task-1
[ORCHESTRATOR] → AUTO-ROUTE: test-engineer
[ORCHESTRATOR] ⚠️ Quality issue found: code-reviewer (non-blocking)
[ORCHESTRATOR] 🚨 ESCALATE: Release-engineer (blocked on migration)
```

---

**Status:** Orchestrator logic designed. Ready for implementation.
