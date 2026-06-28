# Chief of Staff AI Framework — Global Reference

**Location:** `/Users/manojaaa/Agents and Skills`

Master reference for the Chief of Staff AI system. Available across all Claude Code sessions.

## Quick Access

### Skills
- **task-breakdown** → `/Users/manojaaa/Agents and Skills/skills/task-breakdown/SKILL.md`
- **incremental-implementation** → `/Users/manojaaa/Agents and Skills/skills/incremental-implementation/SKILL.md`
- **code-review-and-quality** → `/Users/manojaaa/Agents and Skills/skills/code-review-and-quality/SKILL.md`

### Personas
- **orchestrator** → `/Users/manojaaa/Agents and Skills/agents/orchestrator.md`
- **engineer** → `/Users/manojaaa/Agents and Skills/agents/engineer.md`
- **test-engineer** → `/Users/manojaaa/Agents and Skills/agents/test-engineer.md`
- **code-reviewer** → `/Users/manojaaa/Agents and Skills/agents/code-reviewer.md`
- **ops** → `/Users/manojaaa/Agents and Skills/agents/ops.md`
- **release-engineer** → `/Users/manojaaa/Agents and Skills/agents/release-engineer.md`

### Documentation
- **README** → `/Users/manojaaa/Agents and Skills/README.md`
- **AGENTS.md (Intent Mapping)** → `/Users/manojaaa/Agents and Skills/AGENTS.md`
- **CLAUDE.md Template** → `/Users/manojaaa/Agents and Skills/CLAUDE_TEMPLATE.md`
- **PHASE1_VALIDATION** → `/Users/manojaaa/Agents and Skills/PHASE1_VALIDATION.md`
- **PHASE2_VALIDATION** → `/Users/manojaaa/Agents and Skills/PHASE2_VALIDATION.md`

## How to Use This Framework in Any Project

### Option 1: Reference This Global File (Easiest)
1. In your project's CLAUDE.md, add:
   ```markdown
   See Chief of Staff Framework at: ~/.claude/CSO_FRAMEWORK.md
   ```
2. Reference skills/agents using absolute paths above
3. Done. Framework available in your session.

### Option 2: Copy CLAUDE.md Template
1. Copy `/Users/manojaaa/Agents and Skills/CLAUDE_TEMPLATE.md` to your project as `CLAUDE.md`
2. Claude Code auto-loads it when you open the project
3. Framework immediately available

### Option 3: Install As Plugin (Coming)
```bash
claude plugin install cso-framework
```

## Intent → Skill Mapping

| User Intent | Skill to Invoke | Persona |
|------------|-----------------|---------|
| "Plan this" / "Break this down" | task-breakdown | orchestrator |
| "Implement task X" / "Build this" | incremental-implementation | engineer |
| "Review this" / "Quality check" | code-review-and-quality | code-reviewer |

See `AGENTS.md` for full mapping.

## Workflow Summary

1. **PLAN** → task-breakdown skill → Get task list
2. **EXECUTE** → incremental-implementation skill → Build + test
3. **VALIDATE** → testing (implicit in engineer skill)
4. **REVIEW** → code-review-and-quality skill → Approve/reject
5. **SHIP** → release-engineer persona → Deploy

## Key Files in Framework

```
/Users/manojaaa/Agents and Skills/
├── skills/                          ← 3 core skills
│   ├── task-breakdown/
│   ├── incremental-implementation/
│   └── code-review-and-quality/
├── agents/                          ← 6 personas
│   ├── orchestrator.md
│   ├── engineer.md
│   ├── test-engineer.md
│   ├── code-reviewer.md
│   ├── ops.md
│   └── release-engineer.md
├── README.md                        ← Start here
├── AGENTS.md                        ← Intent mapping
├── CLAUDE_TEMPLATE.md               ← For new projects
├── PHASE1_VALIDATION.md             ← Proof skills work
└── PHASE2_VALIDATION.md             ← Proof personas work
```

## Status

✅ **Phase 1:** 3 core skills built and validated
✅ **Phase 2:** 6 personas built and validated
🔄 **Phase 3:** Live validation on real projects
🔄 **Phase 4:** Extend with additional skills as needed

## For New Users

1. Read `/Users/manojaaa/Agents and Skills/README.md`
2. Copy CLAUDE_TEMPLATE.md to your project
3. Start using: "Plan this work"
4. Framework handles the rest

## Questions?

See individual files:
- Skills: Read SKILL.md files
- Personas: Read .md files in agents/
- Workflow: See README.md or PHASE2_VALIDATION.md example

---

**This file is a global reference. Available to all Claude Code sessions.**
