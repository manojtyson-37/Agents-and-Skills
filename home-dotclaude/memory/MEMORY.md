# Memory Summary (Context-Optimized)

**For detailed explanations, read the individual memory files in this directory. This is for rapid context injection.**

## Core Operating Principles
- **CSO protocol always** — never drop mid-conversation
- **Route work to owners** — superpowers, gstack, subagents; more tools ≠ better
- **Always do real work** — never simulate
- **Test locally** before committing; never ship unverified
- **Run /cso-learn** before "Complete" — mandatory, no exceptions

## Key Feedback (Do/Don't)
- **Proactive monitoring**: CSO must flag token bloat, routing gaps, zero-invocation agents — don't wait for user to notice
- **Always CSO**: Never drop protocol, user corrected this multiple times
- **No fake metrics**: Never hardcode data; user caught 65% fake compression
- **Skill discipline**: Skills must be invoked (visible tool call)—superpowers/verify/cso-learn skipped = protocol violation
- **Hook enforcement**: Prose rules ignored under pressure; only blocking hooks work
- **Real review**: Every code-reviewer dispatch found real bugs—keep dispatching
- **Mobile verification**: 390px viewport + prod screenshot, not DOM inspection
- **Universal editability**: Expense Tracker—all items must support inline edit

## System Layers
- **CSO**: Plan-first, delegate, state in .cso/, dashboard port 3000
- **superpowers**: TDD/subagent/verify methodology (not CSO prose)
- **gstack**: /qa /cso (security) /design-review /ship /canary
- **claude-mem**: Auto episodic memory (don't hand-curate)
- **graphify**: Code-graph tool (keyless-first, check leaks, gitignore output)
- **decision-maker**: Learns preferences, makes reversible calls
- **Subagents**: 7 personas; code-reviewer=opus, others=sonnet

## Known Constraints
- **ESM root**: Standalone scripts must be .cjs
- **Local LLM**: Heavy Ollama heats laptop; prefer cloud
- **Public repos + secrets**: Never commit keys; use ${VAR} + .env
- **Bootstrap drift**: Rerun after adding agents/skills; verify with ls/readlink
- **Isolated testing**: Test against real state can mask bugs; use throwaway repos

- [CSO prefix hook enforcement](feedback_cso_prefix_hook_enforcement.md) — CSO: prefix rule now a real Stop-hook gate (Gate 8), not prose; filter isSidechain in transcript gates
- [AskUserQuestion fallback](feedback_askuserquestion_fallback.md) — Tool fails with internal error; fall back to plain-text A/B/C questions immediately, no retry
- [Stop gate session scope](feedback_stop_gate_session_scope.md) — Use mtime>=sessionStart not existence to detect "did this session touch state files"; persistent files make existence always true
- [Ghost workflow detection](feedback_ghost_workflow_detection.md) — Multi-layer NL detection required; word boundaries, modal+task combos, length gate; single keyword match fires on questions
- [CLAUDE.md length limit](feedback_claude_md_length.md) — 150-line cap overridden by user 2026-07-08; enforcement now via Stop-hook gates, not brevity; keep tables/bullets as style preference only
- [CSO autonomy preferences](feedback_cso_autonomy_preferences.md) — Scope→pick default; deploys→auto after staging; tech→best solution; quality→full TDD; errors→3 tries then surface
- [CSO self-repair design](feedback_cso_self_repair_design.md) — cso-learn feeds self-repair loop; user expects CSO to queue fixes for its own gaps without being asked

- [Session objective enforcement](feedback_session_objective_enforcement.md) — Advisory session-start output ignored; only Stop gate blocking works for "must act this session" requirements
- [Gate implementation quality](feedback_gate_implementation_quality.md) — Hook code always needs full code-reviewer dispatch; NaN/substring bugs found every time self-review was skipped

- [CSO skill routing confusion](feedback_cso_skill_routing_confusion.md) — /cso = security audit skill; CSO orchestrator = CLAUDE.md protocol; never invoke skill to "start CSO"; prose memory alone doesn't prevent — hook enforcement needed
- [Self-repair task protection](feedback_self_repair_task_protection.md) — self-repair tasks (source:"self-repair") must NOT be cancelled with bulk-cancel; they are infrastructure fixes, not user tasks
- [Feedback analyzer false positives](feedback_analyzer_false_positives.md) — <task-notification> XML blobs were classified as user dissatisfaction; fixed with XML guard + tighter patterns (commit 6558505)
- [Stop gate scope exemptions](feedback_stop_gate_scope_exemptions.md) — prod-verify gate must not fire for .cso/ or home-dotclaude/ commits — use lastCommitTouchesDeployedAppCode() not lastCommitTouchesCode() for deployment gates
- [CSO continuous learning](feedback_cso_continuous_learning.md) — user directive: cso-learn every session end, profile updated on every correction, self-repair tasks must execute not just queue
- [Skill tool interrupt](feedback_skill_tool_interrupt.md) — /cso-learn can be interrupted; fallback: inline pass + manual decisions.jsonl entry satisfies stop gate; always tell user when background agent dispatched

**See individual memory files (feedback_*.md, project_*.md, reference_*.md) for full context, rationale, and examples.**
