---
name: agent-framework
description: "Available agents, their capabilities, and when to use each type"
metadata: 
  node_type: memory
  type: reference
  originSessionId: facfa3cd-2762-4467-b784-bdf7042f27d3
---

# Agent Framework

## Available Agent Types

### Caveman Subagents (Specialized, context-efficient)

**caveman:cavecrew-investigator**
- Read-only code locator
- "Where is X defined?" "What calls Y?" "List all uses of Z?"
- Output: caveman-compressed file:line table
- ~60% fewer tokens than vanilla Explore
- Use: When locating code across codebase

**caveman:cavecrew-builder**
- Surgical 1-2 file edits
- Typo fixes, single-function rewrites, mechanical renames
- Hard refuses 3+ file scope
- Returns caveman diff receipt
- Use: Small bounded edits, obvious scope

**caveman:cavecrew-reviewer**
- Diff/branch/file reviewer
- One line per finding, severity-tagged
- Format: `path:line: <emoji> <severity>: <problem>. <fix>.`
- Skips formatting nits unless they change meaning
- Use: Review PR, review diff, audit file

### General-Purpose Agents

**Explore**
- Fast read-only search across codebase
- Find files by pattern, grep symbols/keywords
- "Where is X defined / which files reference Y"
- DO NOT use for: code review, design audits, cross-file consistency checks, open-ended analysis
- Use: Targeted code location, breadth search

**Research Agent** (caveman:cavecrew-investigator or Explore)
- Information gathering
- Market research
- Documentation review
- Competitive analysis

**Builder Agent** (inline or caveman:cavecrew-builder)
- Coding
- Automation
- Scripts
- Technical implementation

**Reviewer Agent** (caveman:cavecrew-reviewer or inline)
- Quality assurance
- Error detection
- Gap analysis
- Security review

**Documentation Agent** (inline)
- SOP creation
- Release notes
- User guides

**Operations Agent** (inline)
- Tracking
- Status management
- Dependency management

## When to Delegate vs. Do Inline

**Delegate if:**
- Task is >3 steps and independent
- Specialized agent is clearly better
- Want context compression for long sessions
- Output doesn't need immediate back-and-forth

**Do inline if:**
- Task is 1-2 steps
- Need tight feedback loop
- Decision required based on result
- Task scope too small for agent overhead

## Agent Constraints

- Agents work WITHIN this conversation (not async)
- Cannot hand off work that continues unsupervised
- Each spawn is a fresh context (pass all relevant info in prompt)
- Results returned as tool result (visible only to main thread)
- Use cavecrew subagents to compress token usage across long sessions
