# CSO — Agents-and-Skills Project Overrides

> Full CSO protocol lives in `~/.claude/CLAUDE.md` (global). This file contains ONLY project-specific deltas. Do not duplicate protocol here.

## Project-Specific Paths

- **State dir (absolute):** `/Users/manojaaa/Agents and Skills/.cso/state/`
- **Decision ledger:** `/Users/manojaaa/Agents and Skills/.cso/decision/`
- **Record decision:** `node "/Users/manojaaa/Agents and Skills/.cso/decision/record-decision.cjs" '{"context":"...","chosen":"...","decidedBy":"user|decision-maker","confidence":"high|medium|low","rationale":"...","reversible":true,"override":false}'`
- **Checkpoint:** `node "/Users/manojaaa/Agents and Skills/.cso/checkpoint/log-session.cjs"`
- **Dashboard:** http://localhost:3000 (reads `.cso/state/`)

## Git Identity

- **Agents-and-Skills repo** → `gh auth switch -u manojtyson-37` before push
- **travel kathegalu** project/folder → `gh auth switch -u travelkathegalu` before push

## State Files (this workspace)

Use absolute paths — never relative `.cso/state/` (breaks in other workspaces):
- `workflow_state.json`, `decisions.jsonl`, `task_history.jsonl`, `metrics.json`
- `notifications.jsonl`, `inbox.json`, `workspaces.json`, `pr-watchdog.json`

## Subagents

Agents live in `.claude/agents/` (symlinked globally via bootstrap). Always pass `model:` when spawning:
- `code-reviewer` → opus | `engineer`, `test-engineer`, `orchestrator`, `release-engineer` → sonnet | `ops`, `decision-maker` → haiku
