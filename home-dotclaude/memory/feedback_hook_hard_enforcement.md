---
name: feedback_hook_hard_enforcement
description: "CLAUDE.md/memory prose rules get read once and dropped under task pressure — only a hook that can actually block (Stop hook returning {decision:block}) is real enforcement"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 3fa6d797-6732-45d9-a3f5-05d144f9d3c8
---

User asked for a full CSO audit after being frustrated that recorded feedback "doesn't get followed." Investigation found the failure was structural, not a one-off miss: a "Routing Enforcement HARD GATE" section had been added to both CLAUDE.md files *earlier the same day* (2026-06-30) to fix exactly this — agents/skills marked mandatory but never invoked. A re-audit run minutes later, same session, found it had changed nothing: the same 5 agents (`code-reviewer`, `decision-maker`, `ops`, `release-engineer`, `test-engineer`) and skills (`/cso-learn`, `/find-skills`, `/code-review`, `/verify`, `/qa`, `/grill-me`, `/security-review`) were still at zero invocations.

**Why:** Every CSO "gate" up to this point was text injected into context (CLAUDE.md prose, or a hook like `on-learn-check.js` that only `console.log`s a warning). The model reads it and can still choose to skip it under task pressure — there was no mechanism that could actually stop a turn from ending non-compliant. `session_log.jsonl` had a literal `"FAILURE: Session ended without learning pass"` entry proving the warning-only hook didn't work even once it existed.

**How to apply:** When a CSO rule keeps getting violated despite being written down (in CLAUDE.md, MEMORY.md, or a routing table), the fix is never "write the rule more emphatically" or "add another bullet point." The fix is a hook that can structurally block: e.g. a `Stop` hook returning `{"decision":"block","reason":"..."}` to Claude Code, which prevents the turn from ending until the reason is addressed (built as `.cso/hooks/on-stop-gate.js`, wired in `~/.claude/settings.json`). Before adding any new "MANDATORY" rule to CLAUDE.md, ask: can this realistically be enforced by a blocking hook, or is it just more prose that will be read once and ignored? If it can't be hook-enforced, say so explicitly rather than implying it's guaranteed.

Separately flagged but unresolved: CSO hooks are wired only in `~/.claude/settings.json` on this one machine — any Claude Code session from a different device/environment has no CSO injection at all. If "CSO not invoked on new sessions" recurs, check whether that session is even running on this machine before assuming it's a logic bug.

**2026-07-01 update — hooks need iterative strengthening too:** The Stop gate existed (Sixth gate: prod verify after push) but was too weak — it accepted DOM inspection (javascript_tool/read_page) as "verification." The NavBar z-index bug was invisible without a visual screenshot. When the user said "fix all of these and ensure important things do not get missed," the correct action was to update the *hook itself* to require navigate + screenshot, not to add more CLAUDE.md text. Hook logic drifts the same way prose does if never revisited. Pattern: when a gate keeps letting bugs through, read the gate's actual checking logic — the weakness is usually in what it accepts as evidence, not that the gate is missing entirely.

Also confirmed (2026-07-01): when user says "CSO to take charge and take decisions," the correct response is autonomous action — diagnose the gaps, decide the fix, implement it in code, commit, no confirmation requested. User does not want to be asked what to do; they want CSO to decide and report back what was changed.

Related: [[feedback_unused_routing_table]] (the specific incident this generalizes from), [[feedback_mobile_ui_verification]] (the gate weakness this fixed).
