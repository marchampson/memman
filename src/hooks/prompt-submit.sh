#!/usr/bin/env bash
# memman prompt-submit hook
# Injects query-relevant context when the user submits a prompt
set -euo pipefail

MEMMAN_BIN="${CLAUDE_PROJECT_DIR}/dist/cli/index.js"

if [ ! -f "${MEMMAN_BIN}" ]; then
  exit 0
fi

# Read the user prompt from stdin
PROMPT=$(cat)

if [ -z "${PROMPT}" ]; then
  exit 0
fi

# Extract first 200 chars as query (avoid passing huge prompts)
QUERY=$(echo "${PROMPT}" | head -c 200)

CONTEXT=$(node "${MEMMAN_BIN}" context --project "${CLAUDE_PROJECT_DIR}" --query "${QUERY}" --max-tokens 300 2>/dev/null || true)

if [ -n "${CONTEXT}" ]; then
  echo "${CONTEXT}"
fi
