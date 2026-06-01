#!/usr/bin/env bash
# Auto-generate CHANGELOG.md from git history
# Usage: ./scripts/gen-changelog.sh [max-commits]
# Default: last 30 commits

set -e

cd "$(dirname "$0")/.."

MAX_COMMITS="${1:-30}"
CHANGELOG="CHANGELOG.md"

# Read current version from package.json
VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo "0.0.0")
TODAY=$(date +%Y-%m-%d)

cat > "$CHANGELOG" << EOF
# Changelog

## [${VERSION}] - ${TODAY}

EOF

git log --oneline -"$MAX_COMMITS" | while IFS= read -r line; do
  hash="${line%% *}"
  msg="${line#* }"
  
  # Parse conventional commit type
  if [[ "$msg" =~ ^feat(\(.*\))?:\ (.*) ]]; then
    type="Features"
    desc="${BASH_REMATCH[2]}"
  elif [[ "$msg" =~ ^fix(\(.*\))?:\ (.*) ]]; then
    type="Fixes"
    desc="${BASH_REMATCH[2]}"
  elif [[ "$msg" =~ ^docs(\(.*\))?:\ (.*) ]]; then
    type="Docs"
    desc="${BASH_REMATCH[2]}"
  elif [[ "$msg" =~ ^chore(\(.*\))?:\ (.*) ]]; then
    type="Chore"
    desc="${BASH_REMATCH[2]}"
  elif [[ "$msg" =~ ^refactor(\(.*\))?:\ (.*) ]]; then
    type="Refactor"
    desc="${BASH_REMATCH[2]}"
  elif [[ "$msg" =~ ^style(\(.*\))?:\ (.*) ]]; then
    type="Style"
    desc="${BASH_REMATCH[2]}"
  elif [[ "$msg" =~ ^perf(\(.*\))?:\ (.*) ]]; then
    type="Performance"
    desc="${BASH_REMATCH[2]}"
  elif [[ "$msg" =~ ^test(\(.*\))?:\ (.*) ]]; then
    type="Tests"
    desc="${BASH_REMATCH[2]}"
  else
    type="Other"
    desc="$msg"
  fi
  
  echo "### ${type}" >> "$CHANGELOG"
  echo "- ${desc}" >> "$CHANGELOG"
  echo "" >> "$CHANGELOG"
done

echo "✅ CHANGELOG.md updated ($MAX_COMMITS commits)"
