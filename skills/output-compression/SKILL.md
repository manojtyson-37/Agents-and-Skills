---
name: output-compression
description: Compress skill outputs and persona reports using Headroom. 60-95% fewer tokens, same information. Reversible via CCR (Cache Compression Retrieval).
---

# Output Compression

Compress all skill outputs, logs, test results, and persona reports using Headroom. Reduces token usage 60-95% without losing critical information.

## How It Works

1. **Capture output** — Raw output from skill or persona (JSON, logs, reports)
2. **Invoke headroom_compress** — Sends through Headroom compression pipeline
3. **Get compressed result** — Smaller representation + retrieval metadata
4. **Use compressed output** — Send to LLM (60-95% fewer tokens)
5. **Retrieve if needed** — Call `headroom_retrieve` to get original (CCR)

## Compression Methods

Headroom intelligently selects compression method:

| Content Type | Method | Reduction | Use Case |
|-------------|--------|-----------|----------|
| JSON (task lists, reports) | SmartCrusher | 70-95% | Structured skill output |
| Code (diffs, implementations) | CodeCompressor (AST) | 60-80% | Engineer task output |
| Logs/prose | Kompress-base (ML model) | 50-75% | Unstructured reports |
| Test results | SmartCrusher | 75-90% | Coverage reports, findings |

## Input Format

```json
{
  "content": "Raw output from skill or persona",
  "content_type": "json|code|log|prose|auto",
  "task_id": "task-3",
  "persona": "engineer",
  "preserve_retrieval": true
}
```

## Output Format

```json
{
  "compressed": "...compressed representation...",
  "reduction_percent": 78,
  "tokens_before": 2145,
  "tokens_after": 467,
  "retrieval_id": "comp_abc123def456",
  "method": "SmartCrusher",
  "reversible": true,
  "note": "Original cached. Use headroom_retrieve with retrieval_id to get full content."
}
```

## Usage (Optional)

This skill runs as MCP server or inline library:

### Option 1: MCP Tool (Recommended)
```
headroom_compress
  input: Raw output
  content_type: auto (auto-detect)
  
Returns: Compressed + retrieval metadata
```

### Option 2: Inline Library
```python
from headroom import compress

result = compress(
    content=raw_output,
    content_type="json"
)
```

## Present Results to User

1. **Original metrics** — Tokens before, after
2. **Reduction** — Percentage saved
3. **Compression method** — Which algorithm (SmartCrusher, CodeCompressor, Kompress)
4. **Reversibility note** — "Original cached via CCR. Can retrieve if needed."

Example:
```
Task output compressed:
  Before: 2,145 tokens
  After: 467 tokens
  Savings: 78%
  Method: SmartCrusher (JSON)
  Retrieval ID: comp_abc123def456 (reversible)
```

## Reversible Compression (CCR)

**Cache Compression Retrieval:**
- Originals are cached locally (not sent to LLM)
- Compressed version sent to LLM
- If LLM needs original: call `headroom_retrieve(comp_abc123def456)`
- Full content returned, LLM can re-analyze

This means: compress aggressively, retrieve selectively.

## Troubleshooting

**Compression too aggressive (missing details)?**
- Mark `preserve_retrieval: true`
- Use `headroom_retrieve` if LLM needs full context

**Unknown content type?**
- Set `content_type: auto`
- Headroom detects automatically (JSON, code, prose, logs)

**Need to retrieve original?**
- Use retrieval_id from compression output
- Call: `headroom_retrieve(retrieval_id)`
- Get full original back

**Headroom not installed?**
- `pip install headroom-ai[all]` (Python)
- `npm install headroom-ai` (Node)
- MCP server configured in .claude/settings.json

## Token Savings by Content Type

| Type | Typical Reduction | Example |
|------|------------------|---------|
| Task lists (JSON) | 80-95% | 10,144 tokens → 1,260 |
| Code diffs | 65-75% | 3,200 tokens → 800 |
| Test reports | 75-90% | 4,500 tokens → 600 |
| Logs | 50-70% | 2,000 tokens → 600 |
| Review findings | 70-85% | 3,100 tokens → 620 |

## Integration with CSO

**All CSO personas use compression:**
- Engineer: compress code output before reporting
- Test-Engineer: compress test results + coverage
- Code-Reviewer: compress findings + recommendations
- Ops: compress status reports
- Release-Engineer: compress deployment logs

**Flow:**
```
Skill output
  ↓
compression skill invokes headroom_compress
  ↓
Compressed output + retrieval_id
  ↓
Send to LLM (60-95% fewer tokens)
  ↓
If LLM needs original: headroom_retrieve(retrieval_id)
  ↓
Full original returned
```

## When NOT to Compress

- **Tiny outputs** (<100 tokens) — overhead not worth it
- **User-facing results** — compress before LLM, not before user sees it
- **Real-time critical** — if latency matters more than token savings

(For most CSO work: always compress before LLM.)
