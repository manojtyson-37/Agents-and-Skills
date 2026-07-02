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

**See individual memory files (feedback_*.md, project_*.md, reference_*.md) for full context, rationale, and examples.**
