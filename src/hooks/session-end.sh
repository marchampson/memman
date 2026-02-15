#!/usr/bin/env bash
# memman session-end hook
# Processes the session transcript for correction capture
# Install: Add to .claude/settings.json hooks.SessionEnd
# This hook runs async (non-blocking) as it may call the LLM

set -euo pipefail

PROJECT_ROOT="${PWD}"
MEMMAN_BIN="${MEMMAN_BIN:-memman}"

# The transcript path is passed as an argument or via env
TRANSCRIPT_PATH="${1:-${CLAUDE_TRANSCRIPT:-}}"

if [ -z "${TRANSCRIPT_PATH}" ] || [ ! -f "${TRANSCRIPT_PATH}" ]; then
  # No transcript available - skip
  exit 0
fi

# Run correction analysis in background (non-blocking)
# The pipeline handles both pattern matching and LLM analysis
"${MEMMAN_BIN}" context --project "${PROJECT_ROOT}" 2>/dev/null &

exit 0
