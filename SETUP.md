# Setup — work on this anywhere

Reproduce the full Agents-and-Skills environment (agents, skills, memory, MCP
servers) on a new machine.

## Prereqs
- [Claude Code](https://claude.com/claude-code) CLI installed (`claude --version`)
- Node.js (for `npx`, used by the Magic MCP)
- Your [21st.dev](https://21st.dev) Magic API key

## Quick start
```bash
git clone https://github.com/manojtyson-37/Agents-and-Skills.git
cd Agents-and-Skills
cp .env.example .env          # then edit .env, set MAGIC_API_KEY
chmod +x bootstrap.sh
./bootstrap.sh                # symlinks globals into ~/.claude, installs plugins
```
Then open the repo with Claude Code.

## What `bootstrap.sh` does (idempotent)
- Symlinks `home-dotclaude/` into `~/.claude/`:
  - `CLAUDE.md`, `CSO_FRAMEWORK.md` (global instructions)
  - `agents/ui-ux-reviewer.md`
  - `skills/ui-ux-pro-max/`
  - `memory/` → `~/.claude/projects/<this-repo-path>/memory/`
- Symlinks the CSO subagents (`.claude/agents/*.md`) into `~/.claude/agents/` so
  they work in every workspace.
- Wires the CSO hooks into `~/.claude/settings.json` with paths resolved to **this
  repo** (no hardcoded user/path — works under any clone location or username).
- Adds plugin marketplaces and installs **caveman**, **ponytail**, **headroom**.
- Reminds you to set `MAGIC_API_KEY`.

## Subagents & decision system
- **Subagents** (`.claude/agents/`): `orchestrator`, `engineer`, `test-engineer`,
  `code-reviewer`, `ops`, `release-engineer`, `decision-maker` — real Claude Code
  agents CSO delegates to via the Agent tool.
- **Decision-maker** learns how you decide. It reads
  `.cso/decision/user_decision_profile.md` + the `.cso/state/decision_patterns.jsonl`
  ledger, makes reversible/low-stakes calls on your behalf, and records every
  decision (and override). Hard-abstains on irreversible/money/secret/outward-facing
  choices. The profile + ledger are versioned, so the learning travels with the repo.

Symlinks (not copies) mean edits you make on any machine stay versioned in git.

## MCP servers
`.mcp.json` (project-scoped, tracked) defines:
- **magic** — `@21st-dev/magic`, key via `${MAGIC_API_KEY}`
- **headroom** — local `headroom` binary, cache at `${HOME}/.headroom/cache`

`${MAGIC_API_KEY}` is read from your environment. Put it in `.env` (gitignored)
or export it in your shell. **The real key is never committed** — the public
repo only stores the `${VAR}` placeholder.

Verify Magic works: in Claude Code run a `logo_search` or
`21st_magic_component_builder` call.

## What is NOT in this repo (by design)
- Real secrets (`.env`, the Magic key)
- Plugin binaries — reinstalled from marketplaces by `bootstrap.sh`
- `headroom` CLI — install separately if you use it
- CSO runtime state (`.cso/state/`) — machine-local
