# memman - Memory Manager for AI Coding Assistants

## Project Overview
- TypeScript/Node.js CLI tool + MCP server + Claude Code hooks
- Syncs CLAUDE.md <-> AGENTS.md, captures corrections, optimizes memory loading
- SQLite for metadata via better-sqlite3, markdown files remain source of truth

## Architecture
- `src/core/` - Shared library (parser, sync, correction, optimizer, staleness, db)
- `src/cli/` - Commander-based CLI entry point and commands
- `src/mcp/` - MCP server with 5 tools (query_memory, save_memory, save_correction, sync_status, suggest_memory)
- `src/hooks/` - Shell scripts for Claude Code hooks (session-start, prompt-submit, post-tool-use, session-end)

## Coding Standards
- ESM throughout (type: module in package.json)
- TypeScript strict mode
- Use `node:` prefix for built-in modules (node:fs, node:path, etc.)
- Prefer `const` over `let`, never use `any`
- All async operations should handle errors gracefully

## Testing
- Use vitest for all tests
- Tests live in `tests/` mirroring `src/` structure
- Fixtures in `tests/fixtures/`
- Run: `bun test`

## Build
- tsup for bundling (separate configs for CLI with shebang vs library)
- `bun run build` to build
- `bun run dev` for watch mode

## Memory (MCP)
- When you learn something new about this project or the user corrects you, use the `save_correction` MCP tool to record it
- When working in an unfamiliar area, use `query_memory` to check for relevant conventions
- Use `save_memory` to persist important decisions or patterns discovered during a session

## Key Conventions
- Managed sections in markdown use `<!-- memman:start id=xxx -->` / `<!-- memman:end id=xxx -->` markers
- Content hashing uses SHA-256 truncated to 16 hex chars
- Hook latency budget: <3 seconds for interactive hooks (no LLM calls)
- LLM analysis (Haiku) only in session-end hook (async, non-blocking)

<!-- memman:start id=synced -->
## Synced from AGENTS.md

- TypeScript/Node.js CLI tool that syncs instruction files across AI coding tools
- Captures corrections made during sessions and persists them
- Optimizes memory file loading via path-scoped rules and selective context injection
- `src/mcp/` - MCP server with tools for mid-session memory operations
- `src/hooks/` - Shell scripts for automated correction capture and context injection
- Managed sections in markdown use HTML comment markers for non-destructive syncing
- Content hashing uses SHA-256 truncated to 16 hex chars
- Interactive hooks must complete within 3 seconds
<!-- memman:end id=synced -->
