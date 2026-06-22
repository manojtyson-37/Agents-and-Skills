# AGENTS.md

Guidance for AI agents working in this Chief of Staff system.

## Overview

This repository implements a **skill-driven execution model** for agent coordination. Intent maps to skills. Skills encode workflows. Agents execute skills consistently.

## Core Rules

1. **If task matches intent, invoke matching skill**
2. **Skills are in `skills/<name>/SKILL.md`**
3. **Never implement directly if skill applies**
4. **Follow skill workflow exactly (no partial application)**

## Intent → Skill Mapping

| Intent | When to Use | Skill | Trigger Phrases |
|--------|-----------|-------|-----------------|
| Planning / Task Breakdown | Starting any substantial work | `task-breakdown` | "Plan this", "Break this down", "What are the steps?" |
| Building / Implementation | Executing a planned task | `incremental-implementation` | "Implement task X", "Write the code", "Build this" |
| Review / Quality Gate | Before merging code | `code-review-and-quality` | "Review this", "Quality check", "Before we ship" |

## Execution Flow

**Every work request follows this lifecycle:**

1. **DEFINE** (Clarify) — What are we building? Why? Success criteria?
2. **PLAN** → `task-breakdown` — Map objective to atomic tasks
3. **BUILD** → `incremental-implementation` — Execute tasks one at a time, test-driven
4. **REVIEW** → `code-review-and-quality` — Quality gate before merge
5. **MERGE** — Approved. Commit pushed.

## How Skills Work

Each skill has:
- **Input format** — What it expects (JSON structure)
- **Output format** — What it produces (JSON structure)
- **How It Works** — Steps to execute
- **Troubleshooting** — Common problems and solutions

Read the full skill definition in `skills/{name}/SKILL.md` when invoking.

## Anti-Rationalization

These thoughts are WRONG:

- "This is too small for a skill"
- "I can just quickly implement this"
- "I'll skip the plan step"

**Correct behavior:** Always check for matching skill first. Always follow workflow.

## Orchestration Rules

### Composition Layers

1. **Skills** (`skills/*/SKILL.md`) — Workflows with steps. The *how*.
2. **Personas** (`agents/*.md`) — Specialized roles. The *who*. (Coming in Phase 2)
3. **Intent** (This file) — User intent mapping. The *when*.

**Rule:** User (or Chief of Staff AI) is orchestrator. Skills do not invoke other skills.

### No Nested Execution

- Skills cannot spawn other skills
- One skill per request/task
- Skill output feeds into next skill input

## Invocation

**Claude Code / Claude API:**

```
Skill tool: "name: task-breakdown"
Prompt: [Include task description, context, constraints]
```

**Output handling:**

1. Read skill output
2. Format for user
3. Request approval before proceeding to next skill

## Adding New Skills

See [SKILL_CREATION.md](SKILL_CREATION.md) for:
- Directory structure
- SKILL.md template
- Script requirements
- Zip packaging

## Examples

### Example 1: Build a Feature

**User request:** "Build a login form"

1. Trigger: `task-breakdown` skill
   - Input: "Build a login form with validation"
   - Output: Task list (setup form, add validation, write tests, etc.)

2. User approves task list

3. For each task, trigger: `incremental-implementation` skill
   - Input: One task from the list
   - Output: Commit hash, tests passing, ready for review

4. Before merge, trigger: `code-review-and-quality` skill
   - Input: Commits from all tasks
   - Output: Findings, recommendation (approved/rejected)

5. If approved, merge.

### Example 2: Fix a Bug

**User request:** "Fix the auth token expiry bug"

1. Trigger: `task-breakdown` skill
   - Input: "Token expiry check fails under concurrent requests"
   - Output: Debugging tasks, fix tasks, regression test tasks

2. Execute tasks via `incremental-implementation`

3. Review via `code-review-and-quality`

4. Ship.

## Skill Status

### Phase 1 (Current) - Core Skills

- ✅ `task-breakdown` — Planning
- ✅ `incremental-implementation` — Building
- ✅ `code-review-and-quality` — Reviewing

### Phase 2 (Planned) - Personas

- 🔄 `orchestrator` — Chief of Staff coordinator
- 🔄 `engineer` — Technical builder
- 🔄 `test-engineer` — Validation specialist
- 🔄 `code-reviewer` — Quality gate specialist
- 🔄 `ops` — Status tracking
- 🔄 `release-engineer` — Shipping

### Phase 3+ (Future) - Additional Skills

- Expand based on real usage patterns
