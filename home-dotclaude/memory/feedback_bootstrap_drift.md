---
name: feedback-bootstrap-drift
description: "bootstrap.sh symlinks drift stale whenever new agents/skills/files are added to the repo — rerun it, don't assume it's current"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 4b79da6f-21c3-46b4-adfa-4aa72bdcf9a2
---

After adding a new subagent (`.claude/agents/*.md`) or a new project-scoped skill meant to be global (`.claude/skills/*`), rerun `bootstrap.sh` immediately. Don't assume prior symlinking still covers new files.

**Why:** Found mid-session — `engineer.md`, `ops.md`, `orchestrator.md`, `test-engineer.md`, `release-engineer.md`, `code-reviewer.md`, `decision-maker.md` existed only in the repo's `.claude/agents/`, never linked into `~/.claude/agents/`, because bootstrap last ran before those files existed (Jun 25 vs Jun 28 additions). Same pattern caught `cso-learn` and `find-skills` skills, which bootstrap never linked at all (only `ui-ux-pro-max` was in the skill-link list) — fixed by adding them to the loop. Also found `PROJ_KEY` in bootstrap only replaced `/` with `-`, not spaces, silently creating a stray wrong-path memory symlink instead of fixing the real one — real memory dir had been a plain untracked directory, kept in sync only by manual copy.

**How to apply:** Treat `bootstrap.sh` as something that needs rerunning after any change to `.claude/agents/` or `.claude/skills/` in this repo, not a one-time setup step. When auditing "is X actually global," verify with `ls -la ~/.claude/agents/` / `~/.claude/skills/` and `readlink`, don't trust the CLAUDE.md claim at face value — check live state first.
