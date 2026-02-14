#!/usr/bin/env bash
# memman prompt-submit hook
# Injects query-relevant context when the user submits a prompt
# Install: Add to .claude/settings.json hooks.UserPromptSubmit

set -euo pipefail

PROJECT_ROOT="${PWD}"
MEMMAN_BIN="${MEMMAN_BIN:-memman}"

# Read the user prompt from stdin
PROMPT=$(cat)

# Generate context based on the prompt
CONTEXT=$("${MEMMAN_BIN}" context --project "${PROJECT_ROOT}" --query "${PROMPT}" --max-tokens 500 2>/dev/null || true)

if [ -n "${CONTEXT}" ]; then
  echo "${CONTEXT}"
fi
