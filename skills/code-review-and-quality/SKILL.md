---
name: code-review-and-quality
description: Review code for bugs, consistency, and quality. Use before merging any work. Identifies issues, suggests fixes, enforces quality gates.
---

# Code Review and Quality

Enforce quality standards before code ships. Catch bugs, consistency issues, and architectural problems before they reach production.

## How It Works

1. **Load Code Under Review** — Read commit, diff, or branch.
2. **Check Correctness** — Does code do what it claims? Any bugs? Edge cases?
3. **Check Consistency** — Does it follow patterns in codebase? Naming? Structure?
4. **Check Efficiency** — Can it be simpler? Any unnecessary complexity?
5. **Check Security** — Any injection points? Exposed secrets? Unsafe patterns?
6. **Flag Findings** — Severity-tagged, one-line each. Include fix suggestion.
7. **Document Blockers** — Anything preventing merge?

## Usage (Optional)

This is a markdown-only skill. No runnable scripts yet. When invoking this skill:

1. Call with Skill tool: `name: code-review-and-quality`
2. Provide: commit hash, branch, or file path to review
3. Skill returns: JSON findings with severity, recommendations

Example trigger phrases:
- "Review this PR"
- "Quality check before merge"
- "What's the verdict?"

## Input Format

```json
{
  "review_type": "commit|branch|file",
  "target": "commit-hash|branch-name|file-path",
  "context": "What should this accomplish?"
}
```

## Output Format

```json
{
  "findings": [
    {
      "file": "src/app.ts",
      "line": 42,
      "severity": "critical|high|medium|low",
      "issue": "Missing null check on user.id",
      "fix": "Add guard: if (!user?.id) throw new Error(...)"
    }
  ],
  "blockers": ["Critical bug found", "Security issue"],
  "recommendation": "approved|needs-changes|rejected",
  "summary": "2 critical, 3 medium issues found"
}
```

## Review Checklist

### Correctness
- [ ] Logic matches requirements
- [ ] Edge cases handled
- [ ] Error handling present
- [ ] Tests cover behavior

### Consistency
- [ ] Matches existing patterns
- [ ] Naming conventions followed
- [ ] Code style consistent
- [ ] No dead code

### Efficiency
- [ ] No unnecessary work
- [ ] No premature abstraction
- [ ] Algorithms reasonable
- [ ] No obvious duplication

### Security
- [ ] No injection risks
- [ ] No secrets exposed
- [ ] Input validated
- [ ] No unsafe patterns

## Present Results to User

1. Summary (# findings, severity breakdown)
2. Blockers first (if any)
3. Findings by severity (critical → low)
4. Recommendation (approved/needs-changes/rejected)
5. Next action (ready to merge / make changes)

## Troubleshooting

**Too many findings?** Prioritize blockers. Others can be follow-up.

**Subjective issue?** Document rationale, not opinion.

**False positive?** Double-check context. Ask clarifying questions.

**Code correct but ugly?** Medium/low priority. Not a blocker.
