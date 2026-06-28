---
name: feedback-cso-research-protocol
description: "When the user says \"research\", run the full protocol — public git repos + web/google + Claude KB, security-screen each, rank top 3 with reasons."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: ec6092c0-934c-49c2-82d0-68a49e9ba3f7
---

When the user says **"research"** (a tool, library, approach, vendor), CSO must run
the FULL research protocol, not a single source:

1. **Public git repos** — search GitHub (`gh repo view`, `gh api`, tree/license/SECURITY.md). Check stars, license, last activity.
2. **Web / Google** — `WebSearch` + `WebFetch` for current state (Claude KB has a cutoff; tools move fast). Use the current month in queries.
3. **Claude knowledge base** — apply what the model already knows, but verify against 1+2.
4. **Security screen each candidate** — license (permissive vs noncommercial vs proprietary), local-first vs cloud, code egress / telemetry / credential handling, documented threat model. A noncommercial license is a BLOCKER for the user's commercial work — disqualify and say why.
5. **Rank the TOP 3** with explicit reasoning for each placement, so the user's decision is narrowed. Include honorable mentions that were disqualified and the disqualifier.
6. **Cost** — state free/paid clearly (OSS core vs paid cloud tier vs paid extras like books/SaaS).

**Why:** User explicitly defined what "research" means to him — breadth across all
sources, security vetting, and a ranked shortlist with rationale — so he decides fast.

**How to apply:** Trigger on the word "research" or "find alternatives / compare options".
Load WebSearch+WebFetch via ToolSearch. Always finish with a ranked top-3 + a one-line
"pick X if…" decision guide. See [[reference-codebase-graph-tools]] for a worked example.
