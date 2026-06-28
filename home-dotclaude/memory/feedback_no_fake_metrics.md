---
name: feedback-no-fake-metrics
description: Never show hardcoded or simulated metrics — user caught the 65% fake compression ratio
metadata: 
  node_type: memory
  type: feedback
  originSessionId: facfa3cd-2762-4467-b784-bdf7042f27d3
---

Never display hardcoded, simulated, or estimated metrics as if they were real. If real data isn't available, show "N/A" or explain the limitation.

**Why:** Token efficiency showed a static 65% because the hook used a hardcoded `0.35` compression multiplier. User spotted it immediately ("Token efficiency is at 65% always I am suspicious of it"). Fake metrics erode trust in the entire dashboard.

**How to apply:** When building metrics/dashboards, only display values derived from actual measurements. If estimation is necessary, label it explicitly as estimated. Self-audit new metrics: if the number never changes, it's probably hardcoded. CSO code-reviewer persona should catch static metrics during review phase.
