---
name: feedback-reference-prompts-scope
description: "When user pastes detailed reference/example prompts they liked, default to studying the technique, not scaffolding a full build"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 4b79da6f-21c3-46b4-adfa-4aa72bdcf9a2
---

When the user shares detailed implementation prompts from a site/source they liked ("I liked this one"), default to extracting the *technique* (the mechanism, the layering, the animation trick) for later reuse — don't scaffold and build a full project from them unless explicitly asked to build.

**Why:** User: "I wanted you to understand how to build and not actually build this sites... I have the prompts so you know how to build this. Or you get some idea." Pasted 4 detailed hero-section prompts after asking earlier "how can you build 3D websites" — read as "build these" and shipped a full 4-route Vite/React project. Real intent was reconnaissance: learn the patterns (Spline-bg, canvas-spotlight-mask, video-scrub+typewriter, particle+video-scrub) to later apply to a real existing project (Travel Kathegalu portfolio).

**How to apply:** If the user's framing is research/exploration ("where are we at", "how do you build X", "do you need skills for this") and they then paste reference prompts, ask whether they want a real build or just want you to internalize the approach — don't assume "they pasted detailed code-able prompts" means "build now." When genuinely ambiguous between learn-only and build, a quick check is cheap; a wrong multi-hour build is not.
