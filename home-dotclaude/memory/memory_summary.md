---
name: memory-summary
description: Ultra-compact one-liner index. Use for context injection; read individual files for full detail.
metadata: 
  node_type: memory
  type: reference
  originSessionId: 75283598-f5cc-4afa-915a-b54082dbaf64
---

# Memory Summary (Context-Optimized)

**For detailed explanations, read the individual memory files. This is for rapid context.**

## Core Operating Principles
- CSO protocol always—never drop mid-conversation
- Route work to owners (superpowers, gstack, subagents)—more tools ≠ better
- Always do real work; never simulate
- Test locally before committing; never ship unverified code
- Run /cso-learn before "Complete"—mandatory, no exceptions

## Feedback (Things to Stop/Start)
- **Always CSO**: Never drop protocol mid-task, user corrected this multiple times
- **No fake metrics**: Never hardcode data, user caught 65% fake compression
- **Skill discipline**: Skills must be actually invoked (visible tool call)—superpowers/verify/cso-learn skipped = protocol violation
- **Hook enforcement**: Prose CLAUDE.md rules ignored under pressure; only blocking hooks work
- **Real review**: Every code-reviewer dispatch found real bugs—keep dispatching, never skip
- **Mobile verification**: 390px viewport + prod screenshot needed, not DOM inspection
- **Universal editability**: Expense Tracker—all items must support inline edit, not just add/delete

## Projects & References
- **CSO**: Plan-first, delegate-heavy, state in .cso/, dashboard on port 3000
- **gstack**: /qa /cso (security) /design-review /ship /land-and-deploy /canary /freeze
- **superpowers**: TDD/subagent/verify methodology; not CSO prose
- **claude-mem**: Auto episodic memory; don't hand-curate
- **graphify**: Code-graph tool; trial keyless-first, check secret leak, gitignore output
- **Decision-maker**: Learns user preferences, makes reversible low-stakes calls
- **Subagents**: 7 personas + models (code-reviewer=opus, others=sonnet). Delegate scoped work
- **Bootstrap**: Rerun after adding agents/skills; verify global links
- **Bootstrap drift**: Don't trust CLAUDE.md claims—verify with ls/readlink

## Constraints & Workarounds
- **ESM root**: Standalone node scripts must be .cjs or they crash
- **Local LLM laptop cost**: Heavy Ollama heats laptop; warn first, prefer cloud
- **Preview tool CWD**: preview_start locked to session-root launch.json; use browse skill elsewhere
- **Public repos + secrets**: Never commit keys; use ${VAR} placeholders + .env
- **Isolated testing**: Test hooks against real session state can mask bugs; isolate with throwaway repos

## Historical Gaps (Fixed/Known)
- workflow_state/metrics decorative, inbox dead 57h+, 5/7 agents never invoked ever
- Stale feedback from earlier sessions not processed into memory (fixed: cso-learn now mandatory)
- Reference prompts = study technique by default, not "build this now" (ambiguous default)
- iOS modals: fixed with sticky footer + z-[60] to beat NavBar z-50

**Read full files in this directory for detailed context, examples, and rationale.**
