#!/usr/bin/env bash
# memman session-start hook
# Injects relevant context at the start of a Claude Code session
set -euo pipefail

MEMMAN_BIN="${CLAUDE_PROJECT_DIR}/dist/cli/index.js"

if [ ! -f "${MEMMAN_BIN}" ]; then
  exit 0
fi

CONTEXT=$(node "${MEMMAN_BIN}" context --project "${CLAUDE_PROJECT_DIR}" --max-tokens 500 2>/dev/null || true)

if [ -n "${CONTEXT}" ]; then
  echo "${CONTEXT}"
fi
