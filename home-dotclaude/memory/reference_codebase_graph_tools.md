---
name: reference-codebase-graph-tools
description: "Researched 2026-06-28 — codebase knowledge-graph tools for AI coding assistants. Top 3: Graphify, CodeGraph, Serena (all MIT, local)."
metadata: 
  node_type: memory
  type: reference
  originSessionId: ec6092c0-934c-49c2-82d0-68a49e9ba3f7
---

Research done 2026-06-28 on codebase-comprehension tools to augment CSO recon.
All "top 3" are MIT + local-first + free + MCP/skill-compatible.

1. **Graphify** (safishamsi/graphify, MIT, free forever) — multimodal graph
   (code+SQL+infra+docs+PDF/img/video), tree-sitter/NetworkX/Leiden on-device, zero
   API calls for parsing; optional LLM semantic pass uses the user's own key (no
   credential storage). Best-documented threat model (SSRF/prompt-injection/XSS guards,
   no shell=True, no eval, stdio-only MCP). PyPI `graphifyy`. Weakness: graph can go
   stale (mitigated by post-commit hook).
2. **CodeGraph** (colbymchenry/codegraph, MIT, 100% local) — SQLite graph, **auto-syncs
   on every file change** (never stale), MCP auto-config for 8 assistants. Code-only,
   leaner, lowest-maintenance. Best "set and forget" structural layer.
3. **Serena** (oraios/serena, MIT) — **LSP-backed** = compiler-grade accuracy for
   symbols/refs/defs (graphs above are heuristic). MCP, mature (~26k stars). Best when
   precision of "what calls X / find definition" matters most. Code-only.

**Disqualified:** GitNexus (abhigyanpatwari/GitNexus) — deepest Claude Code integration
(16 MCP tools + skills + hooks) BUT **noncommercial license** → blocker for commercial
work (Silaa ERP / KBD Credit Solutions). Honorable mention only.
**Lighter category (not graphs):** Repomix (context packing), claude-context / grepai
(semantic search) — fine for repos <10k files.

**Trial result (2026-06-28, Silaa ERP `/Users/manojaaa/Silaa Collective`, graphify 0.8.50):**
Project-scoped install OK. Keyless code graph via `graphify update .` → 128 files → 699
nodes, 1373 edges, 67 communities, **0 token cost, 0 network egress, 0 .env secrets leaked**
(verified). Surfaced god nodes (requireAuth=19 edges, ledger Base=34), production-flow
communities, "no import cycles", blast-radius queryable from graph.json (edges have
`relation`+`confidence`). Keyless limits: communities unnamed ("Community N") and 22 docs
+ 5 images NOT indexed — multimodal/naming needs an LLM key (=content egress to that LLM,
decide separately). `graphify install --project` also writes a CLAUDE.md section +
PreToolUse hooks into the target repo's `.claude/settings.json` (invasive — per-project, not
global yet). Output dir `graphify-out/` should be gitignored. Verdict: code-graph value
confirmed, safe; global rollout pending more usage.

Decision guide: **Graphify** = one tool for everything incl. docs/multimodal + security.
**CodeGraph** = zero-maintenance always-fresh structure. **Serena** = precision symbol nav.
See [[feedback-cso-research-protocol]] and [[project_cso_decision_system]].
