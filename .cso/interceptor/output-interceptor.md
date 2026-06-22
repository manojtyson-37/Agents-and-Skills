# Output Interceptor

Captures all skill and persona outputs before user sees them. Routes through CSO orchestrator.

## Purpose

Every output gets intercepted:
```
Skill/Persona Output
  ↓ (interceptor captures)
Compress via Headroom (60-95%)
  ↓
Pass to Orchestrator for review
  ↓
Orchestrator decides: approve / rework / escalate
  ↓
User sees (or doesn't, depending on decision)
```

## Implementation

### Configuration (Claude Code)

Add to `.claude/settings.json`:

```json
{
  "outputInterception": {
    "enabled": true,
    "compressAll": true,
    "headroomMinTokens": 200
  },
  "hooks": {
    "onToolOutput": ".cso/hooks/intercept-output.js",
    "onPersonaOutput": ".cso/hooks/intercept-output.js"
  }
}
```

### Hook Implementation

File: `.cso/hooks/intercept-output.js`

```javascript
/**
 * Output Interceptor Hook
 * 
 * Triggered on every skill/persona output
 * 1. Captures output
 * 2. Compresses via Headroom
 * 3. Passes to orchestrator
 * 4. Orchestrator decides action
 */

const Headroom = require('headroom-ai');
const Orchestrator = require('../orchestrator/orchestrator.js');
const StateManager = require('../state/state-manager.js');

module.exports = async (output, context) => {
  try {
    // 1. Capture metadata
    const captured = {
      timestamp: new Date().toISOString(),
      source: context.source, // 'skill' or 'persona'
      sourceName: context.sourceName, // task-breakdown, engineer, etc.
      rawOutput: output,
      rawTokens: estimateTokens(output)
    };

    // 2. Compress via Headroom
    const compressed = await Headroom.compress(output, {
      contentType: context.contentType || 'auto',
      preserveRetrieval: true
    });

    captured.compressed = compressed.compressed;
    captured.compressedTokens = compressed.tokens_after;
    captured.retrievalId = compressed.retrieval_id;
    captured.reductionPercent = compressed.reduction_percent;

    // 3. Log capture
    console.log(`[INTERCEPTOR] Captured ${captured.sourceName}: ${captured.rawTokens} → ${captured.compressedTokens} (${compressed.reduction_percent}%)`);

    // 4. Update workflow state
    await StateManager.recordCapture(captured);

    // 5. Pass to orchestrator for review
    const decision = await Orchestrator.review(captured, context);

    // 6. Execute decision
    return await executeDecision(decision, captured);

  } catch (error) {
    console.error('[INTERCEPTOR] Error:', error);
    // Fallback: pass through on error
    return { output, action: 'pass-through', error: error.message };
  }
};

/**
 * Execute orchestrator decision
 */
async function executeDecision(decision, captured) {
  switch (decision.action) {
    case 'APPROVE':
      console.log(`[INTERCEPTOR] ✅ Approved: ${captured.sourceName}`);
      
      // Check if auto-routing needed
      if (decision.nextTask) {
        console.log(`[INTERCEPTOR] → Auto-routing to: ${decision.nextTask}`);
        await StateManager.recordDecision({
          output_id: captured.retrievalId,
          action: 'APPROVED',
          nextTask: decision.nextTask,
          timestamp: new Date().toISOString()
        });
      }
      
      // Show user the output
      return {
        action: 'APPROVE',
        output: captured.rawOutput,
        nextTask: decision.nextTask,
        compressed: captured.compressed,
        savedTokens: captured.rawTokens - captured.compressedTokens
      };

    case 'REWORK':
      console.log(`[INTERCEPTOR] 🔄 Needs rework: ${captured.sourceName}`);
      console.log(`[INTERCEPTOR] Issues: ${decision.issues.join(', ')}`);
      
      await StateManager.recordDecision({
        output_id: captured.retrievalId,
        action: 'REWORK',
        issues: decision.issues,
        timestamp: new Date().toISOString()
      });
      
      // Don't show raw output, show findings instead
      return {
        action: 'REWORK',
        message: `Rework needed in ${captured.sourceName}`,
        issues: decision.issues,
        suggestion: decision.suggestion
      };

    case 'ESCALATE':
      console.log(`[INTERCEPTOR] 🚨 Escalating to user: ${captured.sourceName}`);
      console.log(`[INTERCEPTOR] Reason: ${decision.reason}`);
      
      await StateManager.recordDecision({
        output_id: captured.retrievalId,
        action: 'ESCALATE',
        reason: decision.reason,
        timestamp: new Date().toISOString()
      });
      
      // Show user the issue
      return {
        action: 'ESCALATE',
        message: `⚠️ ${decision.reason}`,
        output: captured.rawOutput,
        needsUserDecision: true
      };

    default:
      return { action: 'unknown', output: captured.rawOutput };
  }
}

/**
 * Estimate tokens (simple heuristic)
 */
function estimateTokens(content) {
  return Math.ceil(content.length / 4); // ~4 chars per token (rough estimate)
}
```

## Interceptor States

```
Output Generated
    ↓
[INTERCEPTED] ← Captured by hook
    ↓
[COMPRESSED] ← 60-95% reduction via Headroom
    ↓
[REVIEWED] ← Orchestrator analyzes
    ├─ [APPROVED] → Auto-route or show to user
    ├─ [REWORK] → Send back to source
    └─ [ESCALATED] → Alert user, wait for decision
```

## Token Savings Tracking

Every interception logs:
- Input tokens
- Output tokens
- Compression %
- Savings

Accumulated in `.cso/state/interceptor_stats.json`:
```json
{
  "total_outputs_intercepted": 47,
  "total_input_tokens": 89234,
  "total_output_tokens": 17856,
  "average_compression": 80,
  "total_tokens_saved": 71378
}
```

## Error Handling

If interceptor fails:
- Log error
- Pass output through unmodified
- Don't block user workflow
- Alert orchestrator

## Configuration Options

### Disable interception for specific outputs
```javascript
// In hook, check:
if (context.skipInterception) {
  return { action: 'pass-through', output };
}
```

### Adjust compression aggressiveness
```bash
export HEADROOM_AGGRESSIVENESS=8  # 1-10, default 7
```

### Minimum token threshold
Only compress outputs > 200 tokens (configurable):
```json
{
  "outputInterception": {
    "headroomMinTokens": 200
  }
}
```

---

**Status:** Interceptor architecture ready. Implement in Task 32 build.
