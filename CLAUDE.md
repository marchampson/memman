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
- Run: `npm test`

## Build
- tsup for bundling (separate configs for CLI with shebang vs library)
- `npm run build` to build
- `npm run dev` for watch mode

## Key Conventions
- Managed sections in markdown use `<!-- memman:start id=xxx -->` / `<!-- memman:end id=xxx -->` markers
- Content hashing uses SHA-256 truncated to 16 hex chars
- Hook latency budget: <3 seconds for interactive hooks (no LLM calls)
- LLM analysis (Haiku) only in session-end hook (async, non-blocking)
