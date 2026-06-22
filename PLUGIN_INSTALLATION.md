# CSO Framework Plugin — Installation & Usage

## Installation Methods

### Method 1: Local Plugin (Development)

For local testing or team development:

```bash
# Clone or navigate to framework directory
cd /Users/manojaaa/Agents\ and\ Skills

# Install as local plugin (development mode)
claude plugin install ./

# Or use absolute path
claude plugin install /Users/manojaaa/Agents\ and\ Skills
```

**Verify installation:**
```bash
claude plugin list
# Should see: cso-framework (v1.0.0)
```

---

### Method 2: GitHub Plugin (Sharing)

For team distribution via GitHub:

**Step 1: Push to GitHub**
```bash
# Create GitHub repo (yourorg/cso-framework)
cd /Users/manojaaa/Agents\ and\ Skills
git init
git add .
git commit -m "Initial CSO framework release"
git remote add origin https://github.com/yourorg/cso-framework.git
git push -u origin main
```

**Step 2: Install from GitHub**
```bash
# Users install via:
claude plugin install yourorg/cso-framework

# Or with full URL:
claude plugin install https://github.com/yourorg/cso-framework.git
```

---

### Method 3: NPM Package (Production)

For broad public distribution:

**Step 1: Publish to npm**
```bash
npm login
npm publish
```

**Step 2: Users install via npm**
```bash
claude plugin install cso-framework
# Or with scope:
claude plugin install @yourorg/cso-framework
```

---

## Verification After Installation

After installing via any method:

### 1. Check Skills Registered
```bash
claude skills list
# Should show:
# - task-breakdown
# - incremental-implementation
# - code-review-and-quality
```

### 2. Check Personas Available
```bash
claude agents list
# Should show 6 personas
```

### 3. Test Skill Invocation
```bash
# Should auto-complete and show skill details
/task-breakdown

/incremental-implementation

/code-review-and-quality
```

---

## Using Installed Plugin

Once installed, framework is available via:

### Via Slash Commands
```
/task-breakdown
/incremental-implementation
/code-review-and-quality
```

### Via Persona Invocation
```
Ask orchestrator to route work
Ask engineer to implement
Ask test-engineer to validate
Ask code-reviewer to approve
Ask ops to track status
Ask release-engineer to deploy
```

### Via Direct Skill Invocation
```
Invoke skill: task-breakdown
Invoke skill: incremental-implementation
Invoke skill: code-review-and-quality
```

---

## Uninstallation

To remove plugin:

```bash
claude plugin uninstall cso-framework
```

---

## Troubleshooting

### Plugin not showing up in `claude plugin list`

1. Verify installation path:
   ```bash
   ls -la /Users/manojaaa/Agents\ and\ Skills/plugin.json
   ```

2. Try reinstalling:
   ```bash
   claude plugin uninstall cso-framework
   claude plugin install /Users/manojaaa/Agents\ and\ Skills
   ```

### Skills not auto-completing

1. Reload Claude Code session
2. Check plugin.json `skills` section is correct
3. Verify SKILL.md files exist in `skills/` directories

### AGENTS.md autodiscovery not working

1. Ensure AGENTS.md exists at repo root
2. Check agents/ directory has .md files
3. Verify plugin.json `agents` section lists all personas

### GitHub installation fails

1. Verify repo is public (or you have access)
2. Check URL format: `user/repo` or full GitHub URL
3. Ensure plugin.json exists in root

---

## Plugin Structure

```
cso-framework/
├── plugin.json              ← Plugin metadata (required)
├── package.json             ← NPM metadata
├── README.md                ← Plugin documentation
├── AGENTS.md                ← Persona autodiscovery
├── CLAUDE_TEMPLATE.md       ← Getting started
├── PHASE1_VALIDATION.md     ← Skills validation
├── PHASE2_VALIDATION.md     ← Personas validation
├── skills/
│   ├── task-breakdown/
│   │   ├── SKILL.md         ← Skill definition (autodiscovered)
│   │   └── scripts/         ← Helper scripts (optional)
│   ├── incremental-implementation/
│   │   ├── SKILL.md
│   │   └── scripts/
│   └── code-review-and-quality/
│       ├── SKILL.md
│       └── scripts/
└── agents/
    ├── orchestrator.md      ← Persona definition (autodiscovered via AGENTS.md)
    ├── engineer.md
    ├── test-engineer.md
    ├── code-reviewer.md
    ├── ops.md
    └── release-engineer.md
```

---

## For Developers: Modifying Plugin

If you modify the plugin:

1. Update `version` in `plugin.json` and `package.json`
2. Test locally: `claude plugin install ./`
3. Commit changes: `git commit -am "Update version X.Y.Z"`
4. Tag release: `git tag v1.0.0`
5. Push: `git push --tags`
6. Publish: `npm publish` (if publishing to npm)

---

## Support

- **Documentation:** See `/Users/manojaaa/Agents and Skills/README.md`
- **Examples:** See PHASE1_VALIDATION.md and PHASE2_VALIDATION.md
- **Issues:** Report via GitHub or update local plugin

---

**Current Status:** Plugin ready for local/GitHub/npm distribution.
