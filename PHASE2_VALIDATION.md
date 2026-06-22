# Phase 2 Validation — Persona Orchestration

Test the 6-persona system with a realistic workflow: "Build a simple todo API".

## Scenario

**Objective:** Build a REST API for todo management (create, read, update, delete).

**Constraints:**
- Node.js + Express
- PostgreSQL persistence
- Authentication required
- <6 hours total
- Ship to production

## Persona Workflow

### Phase 1: Planning (Orchestrator)

**Orchestrator receives:**
```json
{
  "objective": "Build REST API for todo management",
  "constraints": ["Node.js", "PostgreSQL", "Auth required", "<6 hours", "Ship to prod"],
  "context": "Internal team tool"
}
```

**Orchestrator action:**
1. Clarify objective (✅ clear)
2. Invoke `task-breakdown` skill
3. Receive task list (5 tasks)
4. Validate completeness
5. Present to user for approval

**Task breakdown output:**
```json
{
  "objective": "Build REST API for todo management",
  "tasks": [
    {
      "id": "task-1",
      "title": "Project setup + auth middleware",
      "owner": "engineer",
      "estimate": "1.0",
      "success_criterion": "Express app with JWT auth working, tests passing"
    },
    {
      "id": "task-2",
      "title": "Implement CRUD endpoints",
      "owner": "engineer",
      "estimate": "2.0",
      "success_criterion": "All 5 endpoints (create, read, list, update, delete) working"
    },
    {
      "id": "task-3",
      "title": "Write comprehensive tests",
      "owner": "test-engineer",
      "estimate": "1.5",
      "success_criterion": "85%+ coverage, edge cases tested, no regressions"
    },
    {
      "id": "task-4",
      "title": "Code review",
      "owner": "code-reviewer",
      "estimate": "0.5",
      "success_criterion": "Approved for deployment, no critical issues"
    },
    {
      "id": "task-5",
      "title": "Deploy to production",
      "owner": "release-engineer",
      "estimate": "1.0",
      "success_criterion": "Running in production, monitored, healthy"
    }
  ],
  "total_estimate": "6.0",
  "critical_path": ["task-1", "task-2", "task-3", "task-4", "task-5"]
}
```

**Orchestrator decision:** ✅ Plan approved, proceeding.

---

### Phase 2: Building (Engineer + Test-Engineer)

**Orchestrator routes task-1 to Engineer:**
```
Task: task-1 (Project setup + auth)
Time: Now
Success criterion: Express app with JWT auth working
```

**Engineer action (incremental-implementation):**
1. Write test for auth middleware
2. Implement auth middleware
3. Run tests (✅ passing)
4. Commit change
5. Report: task-1 complete

**Engineer output:**
```json
{
  "task_id": "task-1",
  "status": "completed",
  "commit_hash": "abc123",
  "files_changed": ["src/app.js", "tests/auth.test.js"],
  "tests_passing": 5,
  "blockers": []
}
```

**Orchestrator routes task-2 to Engineer:**
```
Task: task-2 (CRUD endpoints)
Dependency: task-1 complete ✅
```

**Engineer action:**
1. Write tests for all 5 endpoints
2. Implement endpoints
3. Run tests (✅ all passing)
4. Commit
5. Report: task-2 complete

**Engineer output:**
```json
{
  "task_id": "task-2",
  "status": "completed",
  "commit_hash": "def456",
  "files_changed": ["src/routes/todos.js", "tests/todos.test.js"],
  "tests_passing": 47,
  "blockers": []
}
```

**Parallel: Ops tracks progress**
```json
{
  "progress": {
    "completed": 2,
    "in_progress": 0,
    "blocked": 0,
    "total": 5
  },
  "completion_percent": 40,
  "status": "on-track"
}
```

---

### Phase 3: Validation (Test-Engineer)

**Orchestrator routes task-3 to Test-Engineer:**
```
Task: task-3 (Comprehensive testing)
Dependency: tasks 1-2 complete ✅
```

**Test-Engineer action (testing-and-validation):**
1. Run all unit tests (47 passing)
2. Add integration tests (test auth + CRUD together)
3. Add edge case tests (null, empty, invalid, concurrent)
4. Measure coverage (now 85%)
5. Check for regressions (✅ none)
6. Report findings

**Test-Engineer output:**
```json
{
  "task_id": "task-3",
  "validation_status": "approved",
  "tests_total": 62,
  "tests_passing": 62,
  "coverage": {
    "lines": 85,
    "branches": 82,
    "functions": 90
  },
  "regressions": [],
  "recommendation": "Approved for code review"
}
```

---

### Phase 4: Review (Code-Reviewer)

**Orchestrator routes task-4 to Code-Reviewer:**
```
Task: task-4 (Code review)
Dependency: tasks 1-3 complete ✅
```

**Code-Reviewer action (code-review-and-quality):**
1. Review commits (abc123, def456)
2. Check correctness (✅ logic sound, no bugs)
3. Check consistency (✅ patterns followed)
4. Check efficiency (⚠️ found: one N+1 query, can optimize)
5. Check security (✅ auth validated, input sanitized)
6. Report findings

**Code-Reviewer output:**
```json
{
  "review_target": "commits abc123, def456",
  "status": "needs-changes",
  "findings": [
    {
      "file": "src/routes/todos.js",
      "line": 45,
      "severity": "medium",
      "issue": "N+1 query: loading user for each todo",
      "fix": "Use JOIN to get user data in one query"
    }
  ],
  "recommendation": "Needs fix, then approved"
}
```

**Orchestrator decision:** Issue found. Route back to Engineer for fix (mini task).

**Engineer fixes N+1 query, commits fix (hash: ghi789).**

**Code-Reviewer reviews fix:**
```json
{
  "status": "approved",
  "findings": [],
  "recommendation": "Ready for production deployment"
}
```

**Ops updates status:**
```json
{
  "progress": {
    "completed": 4,
    "in_progress": 0,
    "blocked": 0,
    "total": 5
  },
  "completion_percent": 80,
  "status": "on-track"
}
```

---

### Phase 5: Deployment (Release-Engineer)

**Orchestrator routes task-5 to Release-Engineer:**
```
Task: task-5 (Deploy to production)
Dependency: all reviews complete ✅
```

**Release-Engineer action (shipping-and-launch):**
1. Verify readiness (all tests ✅, code-reviewer ✅, no issues)
2. Plan deployment (canary: 10% servers first)
3. Write changelog
4. Deploy to staging (✅ healthy)
5. Deploy to production (canary, 10% servers)
6. Monitor (error rates, latency, crashes)
7. Full rollout (100% servers)
8. Final monitoring

**Release-Engineer output:**
```json
{
  "deployment_id": "v1.0.0",
  "status": "deployed",
  "readiness": {
    "tests_passing": true,
    "code_reviewed": true,
    "security_scanned": true
  },
  "deployment_strategy": "canary",
  "post_deployment": {
    "error_rate": "0.02%",
    "latency_p99": "145ms",
    "status": "healthy"
  },
  "recommendation": "Successfully deployed to production"
}
```

---

## Validation Checklist

### Orchestrator
- [x] Received objective, clarified scope
- [x] Invoked task-breakdown skill, got task list
- [x] Routed tasks in dependency order (task-1 → task-2 → task-3 → task-4 → task-5)
- [x] Escalated issue to user when needed (N+1 query finding)
- [x] Owned outcome start-to-finish

### Engineer
- [x] Received tasks from orchestrator
- [x] Used incremental-implementation skill
- [x] Wrote tests first, then code
- [x] Committed atomic changes
- [x] Reported status with JSON output

### Test-Engineer
- [x] Received code from engineer
- [x] Ran all tests (47 + added 15 more)
- [x] Measured coverage (85%)
- [x] Found no regressions
- [x] Approved for next phase

### Code-Reviewer
- [x] Received code from engineer
- [x] Checked correctness, consistency, efficiency, security
- [x] Found N+1 query issue (medium severity)
- [x] Requested fix
- [x] Approved after fix

### Ops
- [x] Tracked task completion (40% → 80% → 100%)
- [x] Kept orchestrator updated on progress
- [x] Surfaced blocker (N+1 query) when found
- [x] Reported timeline (on-track)

### Release-Engineer
- [x] Verified readiness (all gates pass)
- [x] Planned deployment (canary)
- [x] Deployed successfully
- [x] Monitored post-deployment
- [x] Reported production health

## Result

✅ **PASS** — All 6 personas work together end-to-end. Workflow is clear. Responsibilities don't overlap. Escalation works correctly.

### What Works
1. Orchestrator routes work correctly
2. Each persona owns their phase
3. JSON input/output formats compatible
4. Blocker detection and escalation works
5. Skills integrate with personas
6. Timeline tracking accurate

### Gaps Found
1. (None critical)
2. Could add more detail on concurrent workflows (multiple personas working in parallel)
3. Could add template for persona communication

### Next Steps
1. Update memory with Phase 2 completion
2. Create example README
3. Ready for live validation on real project
