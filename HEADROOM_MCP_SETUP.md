# Headroom MCP Server Setup

Configure Headroom as an MCP server for Claude Code to enable compression tools across all sessions.

## Installation

### Step 1: Install Headroom

```bash
# Python (recommended for MCP)
pip install headroom-ai[all]

# Or Node
npm install headroom-ai
```

### Step 2: Add to Claude Code MCP Configuration

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

**Or use environment-based setup:**

```bash
# Set Headroom as global MCP server
export HEADROOM_MCP_ENABLED=true
export HEADROOM_CACHE_DIR="/Users/manojaaa/.headroom/cache"
```

### Step 3: Verify Installation

```bash
# Check Headroom is installed
headroom --version

# Test MCP connection
headroom mcp --test
```

## Available MCP Tools

Once configured, these tools are available to all Claude Code sessions:

### 1. `headroom_compress`
Compress content using Headroom algorithms.

**Input:**
```json
{
  "content": "string to compress",
  "content_type": "json|code|log|prose|auto",
  "task_id": "optional-task-id",
  "preserve_retrieval": true
}
```

**Output:**
```json
{
  "compressed": "compressed content",
  "reduction_percent": 78,
  "tokens_before": 2145,
  "tokens_after": 467,
  "retrieval_id": "comp_abc123def456",
  "method": "SmartCrusher"
}
```

### 2. `headroom_retrieve`
Retrieve original content from cache (CCR).

**Input:**
```json
{
  "retrieval_id": "comp_abc123def456"
}
```

**Output:**
```json
{
  "original": "full original content",
  "status": "retrieved",
  "cached_at": "2026-06-22T10:30:00Z"
}
```

### 3. `headroom_stats`
Get compression statistics.

**Output:**
```json
{
  "total_compressions": 1247,
  "total_tokens_saved": 1234567,
  "average_reduction_percent": 74,
  "cache_size_mb": 345,
  "cache_entries": 892
}
```

## Usage in CSO Personas

Each persona automatically uses compression before reporting:

### Engineer Example
```
Engineer completes task-2 (implement feature)
  → Raw output: 3,200 tokens (code diff, test results)
  → Invoke: headroom_compress(output, content_type="code")
  → Compressed: 850 tokens (73% savings)
  → Report to orchestrator: compressed output + retrieval_id
  → If orchestrator needs original: headroom_retrieve(retrieval_id)
```

### Code-Reviewer Example
```
Code-reviewer reviews commits
  → Raw findings: 2,100 tokens (multiple issues with explanations)
  → Invoke: headroom_compress(findings, content_type="json")
  → Compressed: 420 tokens (80% savings)
  → Report: compressed findings + retrieval_id
```

### Test-Engineer Example
```
Test-engineer validates code
  → Raw report: 4,500 tokens (test output, coverage, edge cases)
  → Invoke: headroom_compress(report, content_type="log")
  → Compressed: 680 tokens (85% savings)
  → Report: compressed summary + retrieval_id
```

## Configuration Options

### Cache Management
```bash
# Set cache directory (default: ~/.headroom/cache)
export HEADROOM_CACHE_DIR="/path/to/cache"

# Set cache size limit (default: 5GB)
export HEADROOM_CACHE_SIZE_GB=10

# Set cache TTL (default: 30 days)
export HEADROOM_CACHE_TTL_DAYS=60
```

### Compression Settings
```bash
# Set compression algorithm preference
export HEADROOM_PREFERRED_ALGORITHM="kompress-v2"  # kompress-v2, smartcrusher, codecompressor

# Set aggressiveness (1-10, default: 7)
export HEADROOM_AGGRESSIVENESS=8

# Preserve all originals for retrieval (default: true)
export HEADROOM_PRESERVE_ORIGINALS=true
```

### Logging
```bash
# Enable debug logging
export HEADROOM_DEBUG=true

# Log file location
export HEADROOM_LOG_FILE="/Users/manojaaa/.headroom/headroom.log"
```

## Integration with CSO Skills

### In task-breakdown Output
```
Task list (JSON, 3,200 tokens)
  ↓ headroom_compress(auto)
Compressed (640 tokens, 80% reduction)
  ↓
Send to LLM (instead of full 3,200)
```

### In incremental-implementation Report
```
Code + tests + commit (4,100 tokens)
  ↓ headroom_compress(code)
Compressed (940 tokens, 77% reduction)
  ↓
Send to LLM
```

### In code-review-and-quality Findings
```
Review findings (2,500 tokens)
  ↓ headroom_compress(json)
Compressed (450 tokens, 82% reduction)
  ↓
Send to LLM for decision
```

## Token Savings Summary

**CSO + Headroom workflow:**

| Phase | Raw Tokens | Compressed | Savings | LLM Cost |
|-------|-----------|-----------|---------|----------|
| Planning (task breakdown) | 3,200 | 640 | 80% | $0.002 |
| Build (engineer reports) | 4,100 | 940 | 77% | $0.003 |
| Validate (test results) | 4,500 | 680 | 85% | $0.002 |
| Review (findings) | 2,500 | 450 | 82% | $0.001 |
| Ship (logs) | 2,100 | 420 | 80% | $0.001 |
| **Total** | **16,400** | **3,130** | **81%** | **$0.009** |

**Without Headroom:** 16,400 tokens = $0.049
**With Headroom:** 3,130 tokens = $0.009
**Savings per workflow:** 80% cost reduction

## Troubleshooting

### MCP Connection Failed
```bash
# Check Headroom is installed and MCP is enabled
headroom mcp --test

# Check settings.json is valid JSON
python -m json.tool ~/.claude/settings.json

# Restart Claude Code
```

### Cache Growing Too Large
```bash
# Check cache size
du -sh ~/.headroom/cache

# Clear old cache entries
headroom cache --purge --days=7

# Resize cache limit
export HEADROOM_CACHE_SIZE_GB=5
```

### Compression Not Working
```bash
# Check Headroom version
headroom --version

# Test compression directly
headroom compress "test content"

# Enable debug logging
export HEADROOM_DEBUG=true
```

## Next Steps

1. Install Headroom: `pip install headroom-ai[all]`
2. Add to ~/.claude/settings.json (see above)
3. Restart Claude Code
4. Tools automatically available: `headroom_compress`, `headroom_retrieve`, `headroom_stats`
5. All CSO personas will use compression automatically

## Resources

- **Headroom Docs:** https://headroom-docs.vercel.app/docs
- **GitHub:** https://github.com/headroomlabs-ai/headroom
- **Discord:** https://discord.gg/yRmaUNpsPJ
- **Architecture:** https://headroom-docs.vercel.app/docs/architecture
