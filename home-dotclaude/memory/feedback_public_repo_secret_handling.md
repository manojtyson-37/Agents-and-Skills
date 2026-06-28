---
name: feedback-public-repo-secret-handling
description: "Before committing any MCP/config to git, check repo visibility; never commit API keys, use ${VAR} placeholders."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: ec6092c0-934c-49c2-82d0-68a49e9ba3f7
---

Before committing MCP config, settings, or anything that may carry credentials,
ALWAYS check `gh repo view --json visibility` first. If public (or unknown),
never commit the real secret — commit a `${VAR}` placeholder (Claude Code
expands env vars in `.mcp.json`), keep the real value in a gitignored `.env`,
and ship a `.env.example` + setup doc. Run `git diff --cached | grep <secret>`
as a final gate before every commit that touches config.

The `Agents-and-Skills` repo is PUBLIC (github.com/manojtyson-37/Agents-and-Skills).
The Magic MCP key lived only in `~/.claude.json` (global, untracked) — never let
it reach the tracked repo.

**Why:** User wanted the env portable across machines but the repo is public; a
committed key would leak permanently into git history. User confirmed the
env-var-placeholder + full-vendor-bundle approach.

**How to apply:** Portable-setup tasks → vendor globals under `home-dotclaude/`,
sanitized `.mcp.json` with `${VAR}`, idempotent `bootstrap.sh` that symlinks
into `~/.claude` and reinstalls plugins from marketplaces, plus `SETUP.md`.
Plugins/binaries are reinstalled, not vendored. See [[project_skills_framework]].
