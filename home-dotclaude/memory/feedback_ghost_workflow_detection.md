---
name: feedback-ghost-workflow-detection
description: Ghost workflow detection must use multi-layer signals — single keyword match from broad list fires on questions and conversational messages
metadata:
  type: feedback
---

The original ghost workflow trigger: any single keyword from `['build','create','fix','update','change',...]` in any prompt. This fired on "is claude mem being used?" (no), "All of the things you mentioned" containing "fix" → created ghost workflow on every conversational message.

Fixed with three layers:
1. **Question filter**: pure question starters (what/how/why/is/are/was...) skip workflow creation. Exception: modal openers (can/could/should/will/would + task keyword) ARE polite task requests — don't filter them.
2. **Length gate**: prompt < 40 chars is never a real workflow task.
3. **Task signal**: strong imperative opener (build/fix/create at start, not "please"/"go ahead") OR 2+ word-boundary keyword matches.

Key mistakes in first draft (caught by code-reviewer):
- "can you build X" was filtered as a question — modal + task keyword = real task
- "please" and "go ahead" in imperativeOpener matched conversational "please explain this" and "go ahead and tell me your thoughts"
- `lp.includes(k)` inflated counts: "remove" matched both "remove" and "move", "add" matched "additional"
- Fix: word-boundary regex `\bkeyword\b` for all keyword matching

**Why:** Single-keyword detection is too coarse for natural language. Task requests and questions use the same vocabulary. Multi-layer detection with word boundaries and length guard is more accurate.

**How to apply:** When tuning any NL intent classifier in a hook: use word boundaries not substring, filter question starters but preserve modal+task combos, require length threshold. False negatives (dropping real tasks) are worse than false positives (creating a ghost that gets archived).

Related: [[feedback_hook_hard_enforcement]]
