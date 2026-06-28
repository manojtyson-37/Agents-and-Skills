---
name: feedback-repo-esm-scripts
description: Agents-and-Skills root package.json is type=module; standalone node scripts must be .cjs or they crash on require().
metadata: 
  node_type: memory
  type: feedback
  originSessionId: ec6092c0-934c-49c2-82d0-68a49e9ba3f7
---

The Agents-and-Skills repo root `package.json` has `"type": "module"`, so any `.js`
file is treated as ESM. Standalone Node scripts that use `require()` will crash with
"require is not defined in ES module scope". Name such scripts `.cjs` (e.g.
`.cso/decision/record-decision.cjs`).

The `.cso/hooks/*.js` files use `require()` and still work because `.cso/hooks/` has
its **own** `package.json` (CommonJS). A new sibling dir like `.cso/decision/` inherits
the root ESM setting unless it has its own package.json.

**Why:** Cost a failed run this session — `record-decision.js` had to be renamed to
`.cjs` after the ESM error.

**How to apply:** When adding a runnable node script to this repo, either name it
`.cjs`, or drop a `{"type":"commonjs"}` package.json in its dir, or write it as ESM
(`import`). Default to `.cjs` for small CommonJS helpers. See [[project_cso_decision_system]].
