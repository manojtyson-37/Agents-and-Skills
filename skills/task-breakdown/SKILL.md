---
name: task-breakdown
description: Break complex objectives into atomic, executable tasks. Use when planning a feature, fixing a bug, or starting any substantial work. Outputs structured task list with dependencies and success criteria.
---

# Task Breakdown

Turn vague objectives into actionable execution plans. This skill maps high-level goals to discrete, sequenced tasks that builders can execute autonomously.

## How It Works

1. **Clarify Objective** — Confirm what success looks like. Constraints. Risks. Dependencies.
2. **Identify Scope Boundaries** — What's in scope? What's explicitly out?
3. **Break into Atomic Tasks** — Each task: one person, <4 hours, single success criterion.
4. **Sequence Tasks** — Order by dependencies. Identify parallelizable work.
5. **Document Success Criteria** — Each task has testable exit condition.
6. **Validate Completeness** — Does sum of tasks achieve objective? Any gaps?

## Usage (Optional)

This is a markdown-only skill. No runnable scripts yet. When invoking this skill:

1. Call with Skill tool: `name: task-breakdown`
2. Provide: objective, constraints, any background context
3. Skill returns: structured JSON task list

Example trigger phrases:
- "Plan this feature"
- "Break this into tasks"
- "What are the steps?"

## Output Format

```json
{
  "objective": "What are we building?",
  "constraints": ["Constraint 1", "Constraint 2"],
  "risks": ["Risk 1: Mitigation"],
  "tasks": [
    {
      "id": "task-1",
      "title": "Task title",
      "description": "What needs to happen",
      "owner": "Agent type (builder/reviewer/ops)",
      "estimate": "effort in hours",
      "success_criterion": "How we know it's done",
      "blockedBy": [],
      "priority": "critical/high/medium"
    }
  ],
  "dependencies": ["External blockers"],
  "total_estimate": "Total hours",
  "critical_path": ["task-1", "task-2"]
}
```

## Present Results to User

1. Objective stated back (confirm understanding)
2. Task list with owners and estimates
3. Critical path highlighted
4. Risks and mitigations called out
5. Ask: "Ready to execute this plan?"

## Troubleshooting

**Vague objective?** Ask clarifying questions:
- Success metric: How do we know this is done?
- Constraints: What limits exist?
- Stakeholders: Who cares about this?

**Tasks too big?** Break further. Each task should fit in 1 work session.

**Too many tasks?** Might be overscoped. Recommend phased approach.

**Circular dependencies?** Redesign task order or identify false dependency.
