---
name: feedback-cso-as-llm-backend
description: "CSO itself is an LLM — do the \"semantic LLM pass\" manually instead of an API key when a tool's LLM step is quota-gated (e.g. graphify community naming)."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: ec6092c0-934c-49c2-82d0-68a49e9ba3f7
---

When a tool needs an "LLM backend" for a semantic step (naming, summarizing, reading
docs) and an API key is unavailable/quota-gated/unwanted, **CSO can BE the LLM** — do
the reasoning in-session and write results into the tool's expected files. No key, no
quota, no cost, no laptop heat.

Worked example (graphify, Silaa, 2026-06-28): Gemini free tier couldn't finish
community naming. Instead Claude read each community's members from
`graphify-out/graph.json` (group nodes by `community`, inspect `source_file` + labels),
named all 70, and wrote them into `graphify-out/.graphify_labels.json` (`{"id":"Name"}`)
+ patched `GRAPH_REPORT.md` headers/nav. Did NOT re-run `cluster-only` (re-clustering
renumbers communities and breaks the labels). Also added a synthesized architecture
summary — the "highlights" graphify normally LLM-generates.

**Why:** User said "do what Gemini would have done, I don't want to think about API
keys." The semantic work is literally what Claude does.

**How to apply:** For graphify-style tools — relabel via the labels file + patch the
report directly, no re-cluster. Generalize: if a step is "call an LLM to interpret X",
consider doing it yourself and writing the artifact, rather than wiring an external key.
See [[reference-codebase-graph-tools]] and [[feedback-timebox-optional-polish]].
