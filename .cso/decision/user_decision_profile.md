# User Decision Profile

CSO's learned model of how the user (manojaaa) makes decisions. The decision-maker
agent reads this before deciding on the user's behalf. Update it when new patterns
emerge or when the user overrides a call. **Behavioral rules only — no secrets.**

Last updated: 2026-06-28 · patterns observed: 5

## Observed tendencies (high confidence)

1. **Takes the recommended option.** When CSO presents choices with one marked
   "(Recommended)", the user has picked it every time (secret handling →
   env-var template; vendoring scope → full bundle). → If a sound recommendation
   exists and the action is reversible, default to it.

2. **Decisive, execution-biased.** Says "go ahead", "fix all of it" — wants work
   done, not more deliberation. → Don't re-ask once intent is clear; bias toward
   acting over surveying options.

3. **Security-conscious about exposure.** Approved keeping API keys out of a
   public repo via placeholders. → Treat any secret/credential/public-exposure
   choice as HARD ABSTAIN, but the user will back the safe option.

4. **Values portability & cross-machine reproducibility.** Wants setups that work
   on any machine later. → Prefer solutions that are path-relative, scripted, and
   self-contained over machine-specific ones.

5. **Values self-improving systems.** Asked CSO to learn how he decides and get
   better. → Prefer options that add learning/recording loops over static ones.

6. **Prefers terse output** (caveman mode active). → Keep decision rationales
   short; lead with the call.

## Confidence thresholds
- DECIDE when: a rule above clearly applies AND action is reversible/low-stakes.
- ABSTAIN when: no matching rule, conflicting precedents, or HARD ABSTAIN class
  (irreversible / money / secrets / outward-facing).

## Open questions (low signal — ask, then record)
- Tolerance for cost/spend trade-offs (no precedent yet).
- Preference on breadth vs. depth when time-boxed.
