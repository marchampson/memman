# memman - Memory Manager for AI Coding Assistants

## Project Overview
- TypeScript/Node.js CLI tool that syncs instruction files across AI coding tools
- Captures corrections made during sessions and persists them
- Optimizes memory file loading via path-scoped rules and selective context injection

## Architecture
- `src/core/` - Shared library (parser, sync, correction, optimizer, staleness, db)
- `src/cli/` - Commander-based CLI entry point and commands
- `src/mcp/` - MCP server with tools for mid-session memory operations
- `src/hooks/` - Shell scripts for automated correction capture and context injection

## Coding Standards
- ESM throughout (type: module in package.json)
- TypeScript strict mode
- Use `node:` prefix for built-in modules
- Prefer `const` over `let`, never use `any`
- All async operations should handle errors gracefully

## Testing
- Use vitest for all tests
- Tests live in `tests/` mirroring `src/` structure
- Run: `npm test`

## Key Conventions
- Managed sections in markdown use HTML comment markers for non-destructive syncing
- Content hashing uses SHA-256 truncated to 16 hex chars
- SQLite for metadata, markdown files remain the source of truth
- Interactive hooks must complete within 3 seconds
