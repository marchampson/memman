#!/usr/bin/env bash
# memman session-start hook
# Injects relevant context at the start of a Claude Code session
# Install: Add to .claude/settings.json hooks.SessionStart

set -euo pipefail

PROJECT_ROOT="${PWD}"
MEMMAN_BIN="${MEMMAN_BIN:-memman}"

# Generate context with recent corrections and high-priority entries
CONTEXT=$("${MEMMAN_BIN}" context --project "${PROJECT_ROOT}" --max-tokens 500 2>/dev/null || true)

if [ -n "${CONTEXT}" ]; then
  # Output as additionalContext (read by Claude Code)
  echo "${CONTEXT}"
fi
