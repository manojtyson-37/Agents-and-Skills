# Headroom Integration — Complete Guide

Headroom is the **context compression layer** for CSO. Reduces token usage 60-95% without losing critical information.

## What Headroom Does

```
CSO output (3,200 tokens)
    ↓
Headroom compression
    ↓
Compressed output (640 tokens, 80% smaller)
    ↓
Send to LLM (saves tokens + cost)
```

**Real example:** Task breakdown output reduced from 10,144 tokens to 1,260 tokens (88% reduction).

## Why CSO Needs Headroom

CSO generates verbose outputs:

| Persona | Typical Output | Tokens | Compressed | Savings |
|---------|---------------|--------|-----------|---------|
| **orchestrator** | Task routing decisions | 2,100 | 420 | 80% |
| **engineer** | Code + tests + status | 4,100 | 940 | 77% |
| **test-engineer** | Test results + coverage | 4,500 | 680 | 85% |
| **code-reviewer** | Findings + recommendations | 2,500 | 450 | 82% |
| **ops** | Status reports + metrics | 1,800 | 360 | 80% |
| **release-engineer** | Deployment logs + health | 2,100 | 420 | 80% |

**Total per workflow:**
- Raw tokens: 17,100
- Compressed: 3,270
- Savings: 81%

## Compression Methods

Headroom intelligently selects the right algorithm:

### 1. SmartCrusher (JSON)
- **Used for:** Task lists, reports, structured data
- **Reduction:** 70-95%
- **Example:** 3,200 tokens → 400 tokens

**Why:** JSON has high redundancy. Crushes structure, keeps meaning.

### 2. CodeCompressor (AST)
- **Used for:** Code diffs, implementations
- **Reduction:** 60-80%
- **Example:** 4,100 tokens → 900 tokens

**Why:** Parses code as syntax tree. Removes comments, whitespace. Keeps logic.

### 3. Kompress-base (ML Model)
- **Used for:** Logs, prose, mixed content
- **Reduction:** 50-75%
- **Example:** 2,500 tokens → 700 tokens

**Why:** Learned model (HuggingFace) removes filler, preserves facts.

### 4. Auto-detection
- **Used for:** Unknown content type
- **Reduction:** 60-85%
- **Logic:** Detects JSON → SmartCrusher, Code → CodeCompressor, Prose → Kompress

## Reversible Compression (CCR)

**Problem:** What if LLM needs the full original?

**Solution: Cache Compression Retrieval (CCR)**

```
Compressed output + retrieval_id sent to LLM
    ↓
If LLM needs full content:
  headroom_retrieve(retrieval_id)
    ↓
Original cached locally, returned on demand
```

**Trade-off:**
- Compress aggressively (keep tokens low)
- Retrieve selectively (only if needed)
- Originals never leave local cache

## Installation & Setup

### Step 1: Install Headroom
```bash
pip install headroom-ai[all]
```

### Step 2: Configure MCP Server
Add to `~/.claude/settings.json`:
```json
{
  "mcpServers": {
    "headroom": {
      "command": "headroom",
      "args": ["mcp"],
      "env": {
        "HEADROOM_CACHE_DIR": "/Users/manojaaa/.headroom/cache"
      }
    }
  }
}
```

### Step 3: Restart Claude Code
Tools automatically available:
- `headroom_compress` — Compress content
- `headroom_retrieve` — Get original from cache
- `headroom_stats` — Compression statistics

## How CSO Uses Headroom

### Engineer Workflow (Example)

```
Engineer completes task-2
  Raw output:
    - Commit hash, files changed
    - Test results (47 tests)
    - Implementation notes
    - Total: 3,200 tokens

  Step 1: Invoke headroom_compress
    Input: output (JSON format)
    Content type: "code"
    
  Step 2: Get compressed result
    Output: 900 tokens (72% reduction)
    Retrieval ID: comp_abc123def456
    
  Step 3: Report to orchestrator
    Send: compressed output + retrieval_id
    Cost: 900 tokens instead of 3,200
    
  If orchestrator needs full details:
    headroom_retrieve(comp_abc123def456)
    Get full original (original stays local)
```

### Code-Reviewer Workflow (Example)

```
Code-reviewer reviews commits
  Raw findings:
    - 15 findings (correctness, consistency, security)
    - Detailed explanations for each
    - Code snippets showing issues
    - Total: 2,500 tokens

  Step 1: Invoke headroom_compress
    Input: findings JSON
    Content type: "json"
    
  Step 2: Get compressed result
    Output: 450 tokens (82% reduction)
    Retrieval ID: comp_def456ghi789
    
  Step 3: Report to orchestrator
    Send: compressed findings + retrieval_id
    Orchestrator can approve/reject
    
  If orchestrator wants to see full detail:
    headroom_retrieve(comp_def456ghi789)
```

## Token Savings by Phase

### Planning Phase
```
Task breakdown output: 3,200 tokens
  → headroom_compress → 640 tokens (80%)
  → Save 2,560 tokens per planning session
```

### Building Phase
```
Engineer reports (5 tasks):
  Task 1: 3,200 → 900 (72%)
  Task 2: 3,500 → 840 (76%)
  Task 3: 2,800 → 700 (75%)
  Task 4: 3,100 → 930 (70%)
  Task 5: 2,400 → 480 (80%)
  ────────────────────────
  Total: 15,000 → 3,850 (74%)
  
  Save: 11,150 tokens across 5 tasks
```

### Validation Phase
```
Test results: 4,500 tokens
  → headroom_compress → 680 tokens (85%)
  → Save 3,820 tokens
```

### Review Phase
```
Code review findings: 2,500 tokens
  → headroom_compress → 450 tokens (82%)
  → Save 2,050 tokens
```

### Deployment Phase
```
Deployment logs: 2,100 tokens
  → headroom_compress → 420 tokens (80%)
  → Save 1,680 tokens
```

### TOTAL WORKFLOW
```
Raw tokens: 27,300
Compressed: 5,440
Tokens saved: 21,860 (80%)

Cost reduction: 80% cheaper
```

## Configuration Options

### Cache Management
```bash
# Set cache location
export HEADROOM_CACHE_DIR="/Users/manojaaa/.headroom/cache"

# Set max cache size
export HEADROOM_CACHE_SIZE_GB=10

# Set cache TTL
export HEADROOM_CACHE_TTL_DAYS=60
```

### Compression Behavior
```bash
# Set preferred algorithm
export HEADROOM_PREFERRED_ALGORITHM="kompress-v2"

# Set aggressiveness (1-10, default 7)
export HEADROOM_AGGRESSIVENESS=8

# Always preserve originals for retrieval
export HEADROOM_PRESERVE_ORIGINALS=true
```

### Logging
```bash
# Enable debug
export HEADROOM_DEBUG=true

# Log to file
export HEADROOM_LOG_FILE="/Users/manojaaa/.headroom/headroom.log"
```

## Monitoring Compression

### Check Statistics
```bash
# Get compression stats
headroom stats

Output:
  Total compressions: 1,247
  Total tokens saved: 1,234,567
  Average reduction: 74%
  Cache size: 345 MB
  Cache entries: 892
```

### Monitor Cache
```bash
# Check cache disk usage
du -sh ~/.headroom/cache

# Clear old entries (>7 days)
headroom cache --purge --days=7

# List cached entries
headroom cache --list
```

## Common Workflows

### Workflow 1: Compress & Send
```
1. Skill produces output
2. headroom_compress(output, type="json")
3. Get compressed + retrieval_id
4. Send compressed to LLM
5. Done (80% token savings)
```

### Workflow 2: Compress, Send, Retrieve If Needed
```
1. Skill produces output (5,000 tokens)
2. headroom_compress(output)
3. Get compressed (1,000 tokens) + id
4. Send compressed to LLM
5. LLM processes, might ask for original
6. headroom_retrieve(id) → get full 5,000 tokens
7. LLM re-analyzes with full context
```

### Workflow 3: Cross-Session Retrieval
```
Session 1:
  Task output (3,200 tokens)
  → headroom_compress → 640 tokens
  → Cache ID: comp_xyz123

Session 2 (days later):
  User asks: "Show me full details of task from yesterday"
  → headroom_retrieve("comp_xyz123")
  → Get original 3,200 tokens
  → Show to user (never lost, always retrievable)
```

## Troubleshooting

### Compression seems incomplete
```bash
# Check aggressiveness setting
echo $HEADROOM_AGGRESSIVENESS

# Increase if too conservative
export HEADROOM_AGGRESSIVENESS=9

# Or reduce to preserve more detail
export HEADROOM_AGGRESSIVENESS=6
```

### Can't retrieve cached content
```bash
# Verify cache exists
ls -la ~/.headroom/cache

# Check retrieval ID is valid
headroom cache --list | grep "comp_xyz123"

# If missing, might be expired
export HEADROOM_CACHE_TTL_DAYS=90  # Extend TTL
```

### Performance degradation
```bash
# Check cache size
du -sh ~/.headroom/cache

# If too large, purge old entries
headroom cache --purge --days=30

# Or reduce max size
export HEADROOM_CACHE_SIZE_GB=5
```

## Integration with Other Tools

### With Claude Code
- MCP server handles compression transparently
- All tools have access: `headroom_compress`, `headroom_retrieve`, `headroom_stats`

### With Persona Outputs
- Each persona automatically calls headroom_compress before reporting
- Transparent to orchestrator

### With CSO Skills
- task-breakdown output → compressed
- incremental-implementation output → compressed
- code-review-and-quality output → compressed
- All automatic via MCP

## Cost Impact

### Example: 1 Week of Work (50 tasks)

**Without Headroom:**
```
50 tasks × 1,500 tokens per task = 75,000 tokens
@ $0.003 per 1k tokens = $225 per week
```

**With Headroom (80% reduction):**
```
75,000 × 0.2 = 15,000 tokens
@ $0.003 per 1k tokens = $45 per week
```

**Savings: $180/week = $9,360/year per user**

---

## Resources

- **Headroom GitHub:** https://github.com/headroomlabs-ai/headroom
- **Headroom Docs:** https://headroom-docs.vercel.app/docs
- **Model Card:** https://huggingface.co/chopratejas/kompress-v2-base
- **Architecture:** https://headroom-docs.vercel.app/docs/architecture
- **Discord:** https://discord.gg/yRmaUNpsPJ

---

**Status:** Headroom fully integrated with CSO framework. Ready for production use.
