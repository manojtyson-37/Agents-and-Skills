# Chief of Staff AI — Skills & Personas Framework

Production-grade agent coordination system. Plan, execute, validate, and ship with clarity and accountability.

## Overview

This is a **skill-driven, persona-based** system for coordinating AI agents to complete complex work end-to-end.

**Core idea:**
- **Skills** encode workflows (task-breakdown, incremental-implementation, code-review-and-quality)
- **Personas** execute skills (orchestrator, engineer, test-engineer, code-reviewer, ops, release-engineer)
- **Intent mapping** routes user requests to the right skill/persona

**Result:** Clear accountability, predictable quality, end-to-end ownership.

## Quick Start

### 1. Get objective from user

```
"Build a CLI todo app with add/list/delete commands"
```

### 2. Orchestrator routes to planning

```
→ task-breakdown skill
Outputs: atomic task list with dependencies
```

### 3. Engineer executes tasks

```
For each task:
  → incremental-implementation skill
  → Write test first, make it pass
  → Commit atomic change
```

### 4. Test-Engineer validates

```
→ testing-and-validation skill (implied by test-engineer persona)
→ Run all tests, measure coverage, detect regressions
```

### 5. Code-Reviewer gates quality

```
→ code-review-and-quality skill
→ Check correctness, consistency, efficiency, security
→ Approve or request changes
```

### 6. Release-Engineer ships

```
→ Plan deployment, deploy, monitor
→ Verify production health
```

## Files & Structure

```
/
├── skills/
│   ├── task-breakdown/
│   │   ├── SKILL.md           ← Planning: objective → tasks
│   │   └── scripts/           ← (future) Helper scripts
│   ├── incremental-implementation/
│   │   ├── SKILL.md           ← Building: task → code + tests
│   │   └── scripts/
│   └── code-review-and-quality/
│       ├── SKILL.md           ← Review: code → findings + approval
│       └── scripts/
│
├── agents/
│   ├── orchestrator.md        ← Coordinator (owns outcome)
│   ├── engineer.md            ← Builder (writes code)
│   ├── test-engineer.md       ← Validator (proves it works)
│   ├── code-reviewer.md       ← Gatekeeper (quality approval)
│   ├── ops.md                 ← Tracker (status + blockers)
│   └── release-engineer.md    ← Shipper (deployment + launch)
│
├── AGENTS.md                  ← Intent → skill mapping
├── SKILL_CREATION.md          ← (future) How to add new skills
├── PHASE1_VALIDATION.md       ← Phase 1 proof
├── PHASE2_VALIDATION.md       ← Phase 2 proof
└── README.md                  ← This file
```

## Headroom Integration

**Context compression layer:** All skill outputs and persona reports are automatically compressed using **Headroom** before reaching the LLM.

- **Token savings:** 60-95% reduction without losing information
- **Reversible:** Original outputs cached locally via CCR (Cache Compression Retrieval)
- **Transparent:** Automatic compression in all personas
- **Cost reduction:** 80% cheaper per workflow

See [HEADROOM_INTEGRATION.md](HEADROOM_INTEGRATION.md) for details.

## Skills

### task-breakdown
**When:** Planning work. "Break this into steps."

**Input:** Objective, constraints, context

**Output:** Atomic task list with dependencies, estimates, success criteria

**Who:** Orchestrator

### incremental-implementation
**When:** Building code. "Execute this task."

**Input:** Task description, success criterion

**Output:** Commit hash, files changed, tests passing, blockers

**Who:** Engineer

### code-review-and-quality
**When:** Quality gate. "Review this before merge."

**Input:** Commits/branch to review

**Output:** Findings (severity-tagged), recommendation (approved/needs-changes)

**Who:** Code-Reviewer

## Personas

### Orchestrator
Coordinator. Routes work. Owns outcome. Makes critical decisions.

**Responsibilities:**
- Clarify objectives
- Plan (invoke task-breakdown)
- Route tasks to personas
- Track progress via ops
- Escalate only critical decisions

### Engineer
Builder. Executes tasks. Owns implementation quality.

**Responsibilities:**
- Execute tasks (invoke incremental-implementation)
- Write tests first
- Commit atomic changes
- Report status + blockers

### Test-Engineer
Validator. Proves work meets requirements. Owns test coverage and regressions.

**Responsibilities:**
- Run comprehensive tests
- Measure coverage (target 80%+)
- Detect regressions
- Test edge cases and errors

### Code-Reviewer
Gatekeeper. Owns merge approval. Enforces quality standards.

**Responsibilities:**
- Review for correctness, consistency, efficiency, security
- Flag findings by severity
- Approve or request changes
- Own merge decision

### Ops
Tracker. Surfaces blockers. Manages dependencies.

**Responsibilities:**
- Track task status
- Surface blockers immediately
- Manage timeline + dependencies
- Report progress to user

### Release-Engineer
Shipper. Owns deployment and production health.

**Responsibilities:**
- Verify readiness before deploy
- Plan deployment strategy
- Deploy + monitor
- Document changes and rollback procedures

## Example Workflow

### Scenario: Build a CLI Tool

**User:** "Build a CLI tool that lists files by size."

**Orchestrator action:**
1. Clarify objective (✅ clear)
2. Invoke `task-breakdown` skill
3. Receive: 4 atomic tasks
4. Present plan to user

**Engineer action (for each task):**
1. Receive task from orchestrator
2. Invoke `incremental-implementation` skill
3. Write test, implement code, commit
4. Report: task complete

**Test-Engineer action:**
1. Run all tests (✅ passing)
2. Measure coverage (✅ 85%)
3. Test edge cases (✅ complete)
4. Approve for code review

**Code-Reviewer action:**
1. Review commits
2. Check correctness, consistency, efficiency, security
3. Approve or request changes

**Release-Engineer action:**
1. Verify readiness
2. Deploy to production
3. Monitor

## Intent → Skill Mapping

| User says | Skill invoked | Who acts |
|-----------|---------------|----------|
| "Plan this" | task-breakdown | Orchestrator |
| "Break this down" | task-breakdown | Orchestrator |
| "Implement this task" | incremental-implementation | Engineer |
| "Execute next task" | incremental-implementation | Engineer |
| "Review this code" | code-review-and-quality | Code-Reviewer |
| "Quality check" | code-review-and-quality | Code-Reviewer |

## Decision Authority

### Orchestrator Decides
- Which work proceeds
- Timeline vs quality trade-offs
- When to escalate (rare)

### Engineer Decides
- Implementation approach
- Refactoring strategy
- Code patterns

### Test-Engineer Decides
- Testing strategy
- Coverage targets
- Test priorities

### Code-Reviewer Decides
- Quality threshold
- Merge approval
- Which findings block merge

### Ops Decides
- Status reporting format
- Blocker communication strategy

### Release-Engineer Decides
- Deployment strategy (all-at-once / canary / staged)
- Rollback triggers
- Monitoring alerts

## Success Criteria

Work complete when:
- [x] Objective clarified (orchestrator)
- [x] Plan created (task-breakdown skill)
- [x] Tasks executed (engineer + incremental-implementation)
- [x] All tests passing (test-engineer)
- [x] Code reviewed + approved (code-reviewer)
- [x] Deployed to production (release-engineer)
- [x] No critical issues

## How to Use This Framework

### Option 1: Local Installation (This Directory)

If you're in this directory (`/Users/manojaaa/Agents and Skills`), everything is available locally.

### Option 2: Use in Any Project (Recommended)

Copy CLAUDE.md template to your project:

```bash
# In your project directory:
cp /Users/manojaaa/Agents\ and\ Skills/CLAUDE_TEMPLATE.md ./CLAUDE.md

# Edit CLAUDE.md for your project
# Claude Code auto-loads it when you open the project
```

See `CLAUDE_TEMPLATE.md` for the template.

### Option 3: Global Reference (Always Available)

The CSO Framework is available globally at:
```
~/.claude/CSO_FRAMEWORK.md
```

Reference this in any project's CLAUDE.md:
```markdown
## Chief of Staff Framework
See: ~/.claude/CSO_FRAMEWORK.md
```

### Option 4: Install As Plugin (Team Distribution)

For sharing with your team:

```bash
# Install locally (development):
claude plugin install /Users/manojaaa/Agents\ and\ Skills

# After publishing to GitHub, team can install:
claude plugin install yourorg/cso-framework

# After publishing to npm:
claude plugin install cso-framework
```

See `PLUGIN_INSTALLATION.md` for full details.

## Invocation Methods Summary

| Method | How | When to Use | Setup |
|--------|-----|-----------|-------|
| **CLAUDE.md template** | Copy to project | Any project needs CSO | 2 min |
| **Global memory** | Reference ~/.claude/CSO_FRAMEWORK.md | Need cross-project ref | Auto |
| **Plugin (local)** | `claude plugin install ./` | Team development | 5 min |
| **Plugin (GitHub)** | `claude plugin install yourorg/cso-framework` | Team with repo | 30 min |
| **Plugin (npm)** | `claude plugin install cso-framework` | Public distribution | 1 hour |

See `INVOCATION_VALIDATION.md` for detailed validation and setup instructions.

## What's Next

- **Phase 3:** Live validation on real project
- **Phase 4:** Additional skills (shipping, error-recovery) based on learnings
- **Phase 5:** Expand personas based on real usage patterns

## Documentation Map

| Document | Purpose |
|----------|---------|
| **README.md** | This file. Overview and quick start. |
| **AGENTS.md** | Full intent → skill mapping. Reference for what invokes what. |
| **CLAUDE_TEMPLATE.md** | Copy this to any project to use CSO. |
| **PLUGIN_INSTALLATION.md** | How to install/distribute as plugin. |
| **INVOCATION_VALIDATION.md** | Validation of all 3 invocation methods. |
| **PHASE1_VALIDATION.md** | Proof that 3 skills work correctly. |
| **PHASE2_VALIDATION.md** | Proof that 6 personas orchestrate correctly. |
| **skills/*/SKILL.md** | Individual skill definitions. |
| **agents/*.md** | Individual persona definitions. |

---

**Status:** Phase 2 Complete. Core framework stable. All 3 invocation methods ready. Ready for real-world validation.
