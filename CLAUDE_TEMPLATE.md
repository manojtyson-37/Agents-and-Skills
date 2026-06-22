# CLAUDE.md Template — Using CSO Framework

Copy this template into your project as `CLAUDE.md` to use the Chief of Staff AI framework.

---

# Project Name

[Brief project description]

## Using Chief of Staff Framework

This project uses the **Chief of Staff AI framework** for planning, execution, and quality control.

### Reference Framework

**Global CSO Framework:** `/Users/manojaaa/.claude/CSO_FRAMEWORK.md`

**Local CSO Installation:** `/Users/manojaaa/Agents and Skills`

### Available Skills

The following skills are available for this project:

1. **task-breakdown** — Plan work into atomic tasks
   - Location: `/Users/manojaaa/Agents and Skills/skills/task-breakdown/SKILL.md`
   - Use when: "Plan this feature" / "Break this down"

2. **incremental-implementation** — Execute tasks with tests
   - Location: `/Users/manojaaa/Agents and Skills/skills/incremental-implementation/SKILL.md`
   - Use when: "Implement this task" / "Execute next"

3. **code-review-and-quality** — Quality gate before merge
   - Location: `/Users/manojaaa/Agents and Skills/skills/code-review-and-quality/SKILL.md`
   - Use when: "Review this" / "Quality check"

### Available Personas

Six specialized personas coordinate work:

- **orchestrator** — Routes work, owns outcomes
- **engineer** — Builds code
- **test-engineer** — Validates and tests
- **code-reviewer** — Quality gates
- **ops** — Tracks status
- **release-engineer** — Ships to production

All personas defined at: `/Users/manojaaa/Agents and Skills/agents/`

### Workflow

1. **Ask:** "Plan this work"
   → Orchestrator invokes task-breakdown skill
   → Get atomic task list

2. **Execute:** "Implement task X"
   → Engineer invokes incremental-implementation skill
   → Build + test one task at a time

3. **Validate:** "Review before merge"
   → Code-reviewer invokes code-review-and-quality skill
   → Approve or request changes

4. **Ship:** "Ready to deploy"
   → Release-engineer handles deployment
   → Monitor production health

### Full Documentation

- **Intent Mapping:** `/Users/manojaaa/Agents and Skills/AGENTS.md`
- **README:** `/Users/manojaaa/Agents and Skills/README.md`
- **How Skills Work:** See individual SKILL.md files
- **How Personas Work:** See individual persona .md files

### Key Principles

- **Plan first.** Always break work down before starting.
- **Test-driven.** Engineer writes tests first, then code.
- **Quality gates.** Code-reviewer approves before merge.
- **Ownership.** Each persona owns their phase.
- **Escalation only when critical.** Keep decision-making distributed.

### Questions?

Refer to:
- `README.md` for overview
- `AGENTS.md` for intent → skill mapping
- Individual `SKILL.md` and persona files for details

---

## Project-Specific Configuration

[Add any project-specific settings, build instructions, deployment info, etc. below]

### Build
```bash
[Your build command]
```

### Test
```bash
[Your test command]
```

### Deploy
```bash
[Your deploy command]
```
