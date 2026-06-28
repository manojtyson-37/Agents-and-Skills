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

# Memory lives under a project dir keyed by this repo's absolute path
# (Claude Code replaces every "/" in the path with "-").
PROJ_KEY="$(echo "$REPO" | sed 's#/#-#g')"
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

echo
echo "==> Magic MCP key"
if [ -f "$REPO/.env" ]; then
  echo "    .env found. Ensure MAGIC_API_KEY is set in it (or exported in your shell)."
else
  echo "    No .env yet. Run: cp .env.example .env  then add your MAGIC_API_KEY."
fi

echo
echo "Done. Open this repo with Claude Code. Verify with:  claude plugin list"
