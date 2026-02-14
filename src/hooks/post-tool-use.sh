#!/usr/bin/env bash
# memman post-tool-use hook
# Flags potential corrections after Edit/Write operations
# Install: Add to .claude/settings.json hooks.PostToolUse

set -euo pipefail

# This hook receives tool use info via environment variables:
# TOOL_NAME - the tool that was used
# TOOL_INPUT - the tool input (JSON)
# TOOL_OUTPUT - the tool output

# Only process Edit operations (most likely to contain corrections)
if [ "${TOOL_NAME:-}" != "Edit" ] && [ "${TOOL_NAME:-}" != "Write" ]; then
  exit 0
fi

# For edits, the correction detection happens in the session-end hook
# via transcript analysis. Here we just log the activity for the pipeline.

# Lightweight: just check if the edit looks like a correction pattern
if echo "${TOOL_INPUT:-}" | grep -qiE '(actually|instead of|wrong|incorrect|should be)' 2>/dev/null; then
  # Flag for later analysis
  echo "[memman] Potential correction detected in ${TOOL_NAME} operation" >&2
fi
