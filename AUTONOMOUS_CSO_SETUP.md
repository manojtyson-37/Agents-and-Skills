# Autonomous CSO - Setup & Activation Guide

Enable fully autonomous Chief of Staff orchestration. One setup, then CSO runs everything.

## What You Get

Once enabled:
- ✅ CSO auto-captures all outputs
- ✅ CSO auto-reviews every step
- ✅ CSO auto-routes work (no manual routing)
- ✅ CSO proactively detects blockers
- ✅ CSO persists workflow state (survives restarts)
- ✅ You never ask "where is CSO" again

---

## Prerequisites

### Required
- [ ] Headroom installed: `pip install headroom-ai[all]`
- [ ] CSO framework cloned/installed: https://github.com/manojtyson-37/Agents-and-Skills.git
- [ ] Claude Code latest version

### Recommended
- [ ] Headroom MCP configured in ~/.claude/settings.json
- [ ] .claude directory with hooks support
- [ ] Node.js 18+ (for hooks scripts)

---

## Installation

### Step 1: Install Framework

```bash
# Option A: Clone from GitHub
git clone https://github.com/manojtyson-37/Agents-and-Skills.git
cd Agents-and-Skills

# Option B: Install as Claude Code plugin
claude plugin install manojtyson-37/Agents-and-Skills
```

### Step 2: Install Headroom

```bash
# Python (recommended)
pip install headroom-ai[all]

# Or Node
npm install headroom-ai
```

### Step 3: Configure Headroom MCP

Add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "headroom": {
      "command": "headroom",
      "args": ["mcp"],
      "env": {
        "HEADROOM_CACHE_DIR": "/Users/YOUR_USERNAME/.headroom/cache",
        "HEADROOM_PRESERVE_ORIGINALS": "true"
      }
    }
  }
}
```

### Step 4: Enable Autonomous CSO

Add to `.claude/settings.json`:

```json
{
  "csoAutonomous": {
    "enabled": true,
    "interceptAll": true,
    "autoRoute": true,
    "proactiveMonitor": true
  },
  "hooks": {
    "onSessionStart": "Agents-and-Skills/.cso/hooks/on-session-start.js",
    "onToolOutput": "Agents-and-Skills/.cso/hooks/on-tool-output.js",
    "onTaskComplete": "Agents-and-Skills/.cso/hooks/on-task-complete.js",
    "onError": "Agents-and-Skills/.cso/hooks/on-error.js",
    "onSessionEnd": "Agents-and-Skills/.cso/hooks/on-session-end.js"
  }
}
```

### Step 5: Verify Setup

```bash
# Check Headroom
headroom --version

# Check hooks
ls -la Agents-and-Skills/.cso/hooks/

# Check state directory
mkdir -p Agents-and-Skills/.cso/state

# Restart Claude Code
# (Full app restart to load new settings)
```

---

## First Run

Start a new work session:

```
You: "Build a CLI tool that lists files by size"

CSO: [Auto-activates, no prompt needed]
  1. Plan created (task-breakdown)
  2. Plan reviewed ✅
  3. Engineer routed to task-1
  4. [Continues autonomously]
  
You: [Watch it work, no manual steps]

CSO: "Workflow complete. 5 tasks done. Token savings: 80%."
```

---

## Configuration Options

### Interception Level

```json
{
  "csoAutonomous": {
    "interceptAll": true,      // Intercept everything (recommended)
    "interceptSkillsOnly": false, // Only skills, not other outputs
    "interceptMinTokens": 200   // Only compress if > 200 tokens
  }
}
```

### Auto-Routing

```json
{
  "autoRoute": {
    "enabled": true,
    "parallelizationAllowed": true,
    "maxQueueDepth": 10,
    "routeDelay": "immediate"
  }
}
```

### Monitoring

```json
{
  "proactiveMonitor": {
    "enabled": true,
    "checkInterval": "5s",         // Check every 5 seconds
    "alertOnOverrun": true,         // Alert if task > estimate
    "alertThreshold": 1.5,          // 50% overrun
    "escalateDelay": "2 minutes"    // Escalate after 2 min overrun
  }
}
```

### Logging

```json
{
  "csoLogging": {
    "level": "info",                // debug, info, warn, error
    "file": "Agents-and-Skills/.cso/logs/cso.log",
    "maxSize": "100MB",
    "archive": true
  }
}
```

---

## User Experience

### What You See

Minimal, focused output:

```
✅ Task-1 complete (engineer)
   Compressed: 78% savings
   
→ Auto-routed to: Test-Engineer

⏳ Monitor: Task-2 slightly slow (+10% over estimate)
   Will finish in ~5 minutes
   
[Later...]

✅ Workflow complete
   Tasks: 5 done
   Duration: 2.5 hours
   Tokens saved: 11,326 (80%)
```

### What You DON'T See

- No manual "where is CSO" needed
- No manual routing between personas
- No "should I review this?" prompts
- No token waste (auto-compressed)
- No blocker surprises (detected proactively)

---

## Troubleshooting

### CSO Not Intercepting

**Check:**
```bash
# 1. Verify hooks configured
grep -A5 "hooks" ~/.claude/settings.json

# 2. Check hook files exist
ls -la Agents-and-Skills/.cso/hooks/

# 3. Verify csoAutonomous enabled
grep -A5 "csoAutonomous" ~/.claude/settings.json

# 4. Restart Claude Code
```

### State Not Persisting

**Check:**
```bash
# 1. State directory exists
ls -la Agents-and-Skills/.cso/state/

# 2. Permissions correct
chmod 755 Agents-and-Skills/.cso/state/

# 3. Check recovery checkpoint
cat Agents-and-Skills/.cso/state/recovery_checkpoint.json
```

### Headroom Not Compressing

**Check:**
```bash
# 1. Test Headroom directly
headroom compress "test content"

# 2. Verify MCP is running
headroom mcp --test

# 3. Check cache directory
ls -la ~/.headroom/cache/

# 4. Check logs
tail -f Agents-and-Skills/.cso/logs/cso.log
```

### Hooks Failing

**Check:**
```bash
# 1. Verify Node.js
node --version

# 2. Check hook syntax
node -c Agents-and-Skills/.cso/hooks/on-session-start.js

# 3. Enable debug logging
export CSO_DEBUG=true

# 4. Check Claude Code logs
# Menu → Help → Show Logs
```

---

## Advanced Configuration

### Override Decision (Manual Override)

If CSO makes a decision you disagree with:

```
CSO: "Decision: REWORK"
You: /cso-override approve  # Override: approve anyway

CSO: "Overridden. Approving and routing."
```

### Disable Temporarily

```json
{
  "csoAutonomous": {
    "enabled": false  // Disable for manual work
  }
}
```

Then enable later:
```
/cso-enable
```

### Custom Decision Rules

Define custom rules in `.cso/config/decision-rules.json`:

```json
{
  "rules": [
    {
      "if": "quality_issues_count > 3",
      "then": "escalate",
      "reason": "Too many issues, need user input"
    },
    {
      "if": "task_overrun > 100%",
      "then": "escalate",
      "reason": "Critical delay on task"
    }
  ]
}
```

---

## Monitoring & Metrics

### Check Session Metrics

```bash
# Get latest workflow metrics
cat Agents-and-Skills/.cso/state/metrics.json

# Get decision history
tail -20 Agents-and-Skills/.cso/state/decisions.jsonl

# Get task history
grep "task-2" Agents-and-Skills/.cso/state/task_history.jsonl
```

### Example Metrics

```json
{
  "tasksCompleted": 5,
  "totalTokens": 14045,
  "compressedTokens": 2719,
  "tokensSaved": 11326,
  "compressionPercent": 80.6,
  "decisionsApproved": 5,
  "decisionsRework": 1,
  "decisionsEscalated": 0,
  "blockersDetected": 0,
  "blockersPreventedProactively": 2
}
```

---

## Support

### Debug Commands

```bash
# Check CSO status
/cso status

# View current workflow
/cso workflow

# View decisions made
/cso decisions

# Enable debug logging
/cso debug on

# View logs
/cso logs tail -20
```

### Get Help

```
/cso help          # Show CSO commands
/cso help routing  # Help on auto-routing
/cso help monitor  # Help on blocker detection
```

---

## Next Steps

1. ✅ Install prerequisites (Headroom)
2. ✅ Clone framework
3. ✅ Configure settings
4. ✅ Restart Claude Code
5. ✅ Try first workflow: `"Build a simple script"`
6. Watch CSO orchestrate autonomously
7. Check metrics: `cat .cso/state/metrics.json`

---

**Status:** Ready for autonomous orchestration.

**Result:** CSO takes over. You focus on outcomes, not coordination.
