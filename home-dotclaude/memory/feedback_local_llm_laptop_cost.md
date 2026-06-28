---
name: feedback-local-llm-laptop-cost
description: "Heavy local LLM (Ollama 14B etc.) on the user's laptop causes heat/fan; warn first and prefer keyless or cloud, don't push finicky local passes."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: ec6092c0-934c-49c2-82d0-68a49e9ba3f7
---

Running a large local model (e.g. Ollama `qwen2.5-coder:14b`, 9GB) on the user's
laptop (M5 Pro, 24GB) pegs the GPU/CPU → heat + fans. Before kicking off any heavy
local-LLM workload, **warn about the resource/heat cost up front** and offer the
lighter path. Stop the run and free the model when the job isn't paying off — don't
cook the laptop for marginal results.

Specific gotcha: **graphify's Ollama backend does not apply `GRAPHIFY_OLLAMA_NUM_CTX`**
— llama-server loaded at `-c 4096` regardless, so graphify's large doc chunks truncate,
the model refuses/rambles ("I can't assist with that"), and the doc/multimodal pass
fails. So local multimodal graphify is not reliable on a laptop today.

**Why:** User noticed the laptop heating during the 14B run; the run was failing anyway
due to the context cap. Heat for no payoff.

**How to apply:** For graphify, the **keyless code graph** (`graphify update .`) is the
reliable, zero-heat, zero-egress value — default to it. For docs/naming, prefer a cloud
key (Gemini free tier = no laptop heat) over local, or skip. Always tell the user the
cost before a heavy local run, and offer to stop. See [[reference-codebase-graph-tools]]
and [[feedback-safe-tool-trials]].
