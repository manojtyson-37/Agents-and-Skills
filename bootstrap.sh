#!/usr/bin/env bash
# Bootstrap this Agents-and-Skills setup on a fresh machine.
# Idempotent: safe to re-run. Symlinks repo -> ~/.claude so edits stay in git.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_HOME="$HOME/.claude"
SRC="$REPO/home-dotclaude"

echo "==> Repo:        $REPO"
echo "==> Claude home: $CLAUDE_HOME"

mkdir -p "$CLAUDE_HOME/agents" "$CLAUDE_HOME/skills"

link() {  # link <repo-path> <target-path>
  local src="$1" dst="$2"
  [ -e "$src" ] || { echo "    skip (missing): $src"; return; }
  rm -rf "$dst"
  ln -s "$src" "$dst"
  echo "    linked: $dst -> $src"
}

echo "==> Linking global config, agent, skill"
link "$SRC/CLAUDE.md"                  "$CLAUDE_HOME/CLAUDE.md"
link "$SRC/CSO_FRAMEWORK.md"           "$CLAUDE_HOME/CSO_FRAMEWORK.md"
link "$SRC/agents/ui-ux-reviewer.md"   "$CLAUDE_HOME/agents/ui-ux-reviewer.md"
link "$SRC/skills/ui-ux-pro-max"       "$CLAUDE_HOME/skills/ui-ux-pro-max"

echo "==> Linking CSO subagents into ~/.claude/agents (available in every workspace)"
for a in "$REPO"/.claude/agents/*.md; do
  [ -e "$a" ] && link "$a" "$CLAUDE_HOME/agents/$(basename "$a")"
done

echo "==> Linking CSO skills into ~/.claude/skills (available in every workspace)"
for s in cso-learn find-skills; do
  [ -e "$REPO/.claude/skills/$s" ] && link "$REPO/.claude/skills/$s" "$CLAUDE_HOME/skills/$s"
done

# Memory lives under a project dir keyed by this repo's absolute path
# (Claude Code replaces every "/" in the path with "-").
PROJ_KEY="$(echo "$REPO" | sed -e 's#/#-#g' -e 's/ /-/g')"
PROJ_DIR="$CLAUDE_HOME/projects/$PROJ_KEY"
echo "==> Linking memory into $PROJ_DIR/memory"
mkdir -p "$PROJ_DIR"
link "$SRC/memory" "$PROJ_DIR/memory"

echo "==> Installing plugins (marketplaces + plugins)"
add_mp()  { claude plugin marketplace add "$1" 2>/dev/null || echo "    marketplace exists: $1"; }
add_pl()  { claude plugin install "$1" 2>/dev/null || echo "    plugin exists: $1"; }
add_mp "JuliusBrussee/caveman"
add_mp "DietrichGebert/ponytail"
add_mp "headroomlabs-ai/headroom"
add_pl "caveman@caveman"
add_pl "ponytail@ponytail"
add_pl "headroom@headroom-marketplace"

echo "==> Wiring CSO hooks into ~/.claude/settings.json (paths resolved to this repo)"
HOOKS_DIR="$REPO/.cso/hooks"
SETTINGS="$CLAUDE_HOME/settings.json" REPO="$REPO" node <<'NODE'
const fs = require('fs');
const path = require('path');
const settingsPath = process.env.SETTINGS;
const hooksDir = path.join(process.env.REPO, '.cso/hooks');
const cmd = f => `node '${path.join(hooksDir, f)}'`;
const one = (...files) => [{ hooks: files.map(f => ({ type: 'command', command: cmd(f) })) }];
let s = {};
try { s = JSON.parse(fs.readFileSync(settingsPath, 'utf-8')); } catch {}
s.hooks = Object.assign({}, s.hooks, {
  UserPromptSubmit: one('on-user-prompt.js', 'on-user-feedback.js', 'on-learn-check.js'),
  SessionStart:     one('on-session-start.js'),
  SessionEnd:       one('on-session-end.js'),
  PostToolUse:      one('on-tool-output.js'),
  TaskCompleted:    one('on-task-complete.js'),
});
fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
fs.writeFileSync(settingsPath, JSON.stringify(s, null, 2) + '\n');
console.log('    wired 5 hook events ->', hooksDir);
NODE
chmod +x "$HOOKS_DIR"/*.js "$REPO/.cso/daemon/cso-daemon.js" "$REPO/.cso/decision/record-decision.cjs" 2>/dev/null || true

echo
echo "==> Magic MCP key"
if [ -f "$REPO/.env" ]; then
  echo "    .env found. Ensure MAGIC_API_KEY is set in it (or exported in your shell)."
else
  echo "    No .env yet. Run: cp .env.example .env  then add your MAGIC_API_KEY."
fi

echo
echo "Done. Open this repo with Claude Code. Verify with:  claude plugin list"
