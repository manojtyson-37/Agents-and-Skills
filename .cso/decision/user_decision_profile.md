# User Decision Profile

CSO's learned model of how the user (manojaaa) makes decisions. The decision-maker
agent reads this before deciding on the user's behalf. Update it when new patterns
emerge or when the user overrides a call. **Behavioral rules only — no secrets.**

Last updated: 2026-07-08 · patterns observed: 15

## Observed tendencies (high confidence)

1. **Takes the recommended option.** When CSO presents choices with one marked
   "(Recommended)", the user has picked it every time (secret handling →
   env-var template; vendoring scope → full bundle). → If a sound recommendation
   exists and the action is reversible, default to it.

2. **Decisive, execution-biased.** Says "go ahead", "fix all of it", "go ahead" —
   wants work done, not more deliberation. Approvals are terse and immediate.
   → Don't re-ask once intent is clear; bias toward acting over surveying options.
   When user says "go ahead" / "do it" / "yes", treat as unconditional approval.

3. **Security-conscious about exposure.** Approved keeping API keys out of a
   public repo via placeholders. → Treat any secret/credential/public-exposure
   choice as HARD ABSTAIN, but the user will back the safe option.

4. **Values portability & cross-machine reproducibility.** Wants setups that work
   on any machine later. → Prefer solutions that are path-relative, scripted, and
   self-contained over machine-specific ones.

5. **Values self-improving systems.** Asked CSO to learn how he decides and get
   better. Immediately approved adding passive learning loops, decision gating,
   and model-per-persona routing. → Always prefer options that add learning/
   recording/enforcement loops over options that rely on manual discipline.

6. **Prefers terse output** (caveman mode active). → Keep decision rationales
   short; lead with the call.

7. **Approves infrastructure improvements without debate.** Model routing, hook
   gates, pattern capture — all approved on first proposal with "go ahead" or
   equivalent. → When CSO proposes an enforcement/tooling improvement for itself,
   auto-approve if reversible and not touching prod/secrets.

8. **Scope gaps → pick and proceed.** When a task is ambiguous (e.g. "add auth"),
   CSO should pick the most sensible/common default, execute, and tell the user what
   it chose. No upfront clarifying question unless the ambiguity is truly blocking.

9. **Deploy pipeline: staging-verify then auto-deploy.** CSO verifies in staging
   first; if staging passes, deploy to production without asking. No confirmation
   prompt needed mid-pipeline. Only ask if staging *fails* and the fix path is unclear.

10. **Tech choices → best solution, backward-compatible.** Always pick the best
    technical approach for the problem — not just "what's already there." Hard constraint:
    new tech/patterns must not break existing products. If a better library would require
    migrating existing code, do the migration as part of the task.

11. **Quality bar → full TDD always.** Tests written first (red), implementation makes
    them green, code-reviewer agent reviews, all must pass before "done." No shipping
    without this gate. Smoke-test-only is not acceptable.

12. **Error recovery → 3 autonomous attempts, then surface.** If CSO hits a blocker
    (build fails, API shape wrong, etc.), try up to 3 different fixes autonomously.
    After 3 failures, stop, describe what was tried and why each failed, and ask the
    user for direction on next steps. Don't ask on first or second failure.

13. **No interruptions during execution once intent is clear.** If CSO has enough
    context to proceed (rules above cover the decision), it should execute fully and
    summarize at the end. Mid-task check-ins are friction, not value.

14. **Stuck-workflow recovery at 5 rework cycles.** If a single task accumulates 5+
    rework cycles without completing, stop autonomous retry. Surface to user with:
    what was attempted, why each attempt failed, and the specific blocker. Evidence:
    push-and-deploy task reached 12 rework cycles and 3.7M tokens before being
    flagged manually. This rule caps autonomous churn at 5 cycles.

15. **Self-audit consistency fixes → CSO decides autonomously, no ask.** When CSO's own
    audit finds a small, reversible, non-prod, non-secret inconsistency (broken/misplaced
    symlink, stray file, naming drift) and recommends a fix, user wants CSO to just do it —
    don't surface as a question next time, act and report. Evidence: ui-ux-reviewer.md
    symlink pointed at wrong source dir; user said "go ahead" then explicitly told CSO to
    have decision-maker own this class of call going forward. Extends rule 7 to explicitly
    cover CSO's own infra/file hygiene, not just tooling/enforcement additions.

## Confidence thresholds
- DECIDE when: a rule above clearly applies AND action is reversible/low-stakes.
- ABSTAIN when: no matching rule, conflicting precedents, or HARD ABSTAIN class
  (irreversible / money / secrets / outward-facing).

## Open questions (low signal — ask, then record)
- Tolerance for cost/spend trade-offs (some signal: approved opus for code-reviewer
  without asking about cost, suggesting cost is not a blocker for quality gates).
- Preference on breadth vs. depth when time-boxed.

## Candidate rules (auto-distilled)
- [unknown — no active workflow]: approve (seen 3 times, high-confidence: 100%)
