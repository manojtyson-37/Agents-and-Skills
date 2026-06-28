---
name: feedback-framework-sprawl
description: "More skills/frameworks ≠ better. When adding overlapping tools, assign ONE owner per function and warn about context bloat — don't just stack."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: ec6092c0-934c-49c2-82d0-68a49e9ba3f7
---

The user adds many Claude Code frameworks to make CSO better (CSO + gstack + superpowers +
graphify + claude-mem). Past a point, stacking overlapping systems **degrades** output:
context bloat every session, auto-trigger collisions, duplicated memory/methodology.

When the user adds a new framework, CSO must:
1. **Map overlap** against what's already installed (which function does it own?).
2. If it overlaps, **assign one owner per function** and say so — don't run two systems for
   the same job (e.g. methodology=superpowers OR gstack OR CSO-prose, pick one).
3. **Flag context/cost bloat** as a real risk to the stated goal (better output).
4. Offer the disciplined option ("consolidate first / hold") alongside "adopt".

**Why:** User's goal is a self-sufficient CSO with better output + decisions — which is a
coherence problem, not a count problem. A good chief of staff curates, not hoards.

**How to apply:** On any "add this tool" request, give the layered-ownership view before
installing. Current owners: CSO=brain, superpowers=methodology, gstack=tools, graphify=recon,
claude-mem=episodic memory, cso-learn=curated memory. See [[reference-superpowers-claudemem]]
and [[feedback-route-new-skills]].
