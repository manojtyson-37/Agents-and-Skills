---
name: reference-gstack
description: "gstack (garrytan/gstack, MIT) at ~/.claude/skills/gstack, non-team, upgraded to 1.91.94.0 on 2026-10-13; tools layer under CSO. Full routing map lives in CLAUDE.md."
metadata: 
  node_type: memory
  type: reference
  originSessionId: ec6092c0-934c-49c2-82d0-68a49e9ba3f7
---

Installed 2026-06-28, **non-team mode** (no silent auto-update), user-scope at
`~/.claude/skills/gstack`. Upgraded 1.58.5.0 → **1.91.94.0** on 2026-10-13 via `/gstack-upgrade`.
Needs **Bun ≥ 1.4.2** (upgraded 1.3.14 → 1.4.3 same day; `gstack-doctor --check` flagged it).
Verify health: `~/.claude/skills/gstack/bin/gstack-doctor --check` → expect `gstack: ok`.

**Relationship to CSO:** one owner per layer (user decision 2026-06-28): CSO = brain/state,
superpowers = methodology (TDD, debugging), **gstack = tools**, graphify = recon, claude-mem =
episodic memory, cso-learn = curated principles. Keep CSO as orchestrator.

**Routing:** full skill→task map is the "gstack routing" section in `home-dotclaude/CLAUDE.md`
(symlinked to `~/.claude/CLAUDE.md`), with a short copy injected by `.cso/hooks/on-user-prompt.js`.
Update both when gstack adds/removes skills ([[feedback-route-new-skills]]).

**Name collision:** gstack `/cso` = **security audit**, not the Chief-of-Staff orchestrator.
`.cso/hooks/on-pretool-skill-gate.js` denies `Skill("cso")` on exact name `cso`, EXCEPT when the latest genuine user message (read from the transcript tail) typed `/cso` or said "security audit" (user decision 2026-10-13; fails closed; tests in `.cso/hooks/test/skill-gate.test.js`). Allows the call if the hook itself errors/times out. Otherwise use `/security-review`.

**Deliberately NOT enabled (2026-10-13):**
- plan-tune AskUserQuestion hooks — overlap CSO's own `on-pretool-question-gate.js`.
- team mode / auto_upgrade — supply-chain risk; upgrade manually with `/gstack-upgrade`.
- gbrain (`/setup-gbrain`) — overlaps claude-mem. Codex CLI not installed (Claude subagent is the outside voice).

**Enabled 2026-10-13 (user: never commit secrets to public repos):** `gstack-config set redact_prepush_hook true` + per-repo hook via `gstack-redact install-prepush-hook` (installed in Agents-and-Skills, which is PUBLIC). Blocks pushes whose added lines contain HIGH-severity credentials; bypassed by `--no-verify` / `GSTACK_REDACT_PREPUSH=skip`; does not scan history. **Install it in every repo** (`/ship` does it automatically; for repos pushed without `/ship`, run `gstack-redact install-prepush-hook` inside the repo).

**Side effect of setup:** registers a silent Stop hook (`timeline-stop-hook`, source
`gstack-timeline-stop`) in `~/.claude/settings.json`; verified it emits nothing and does not
interfere with CSO Stop gates. Remove: `gstack-settings-hook remove-source --source gstack-timeline-stop`.

**Overlaps:** gstack `/learn` ≈ cso-learn; gstack design skills vs ui-ux-pro-max (both available).
