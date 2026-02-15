# memman

Unified memory manager for AI coding assistants. Sync CLAUDE.md and AGENTS.md, auto-capture corrections, and optimize memory loading across Claude Code, Codex, Cursor, and more.

## The Problem

- AI coding tools each have their own instruction format (CLAUDE.md, AGENTS.md)
- Teams using multiple tools maintain parallel files manually
- Memory files grow bloated, loading irrelevant context every session
- Corrections made during sessions are lost

## What memman Does

**Sync** - Bidirectional sync between CLAUDE.md and AGENTS.md with conflict detection

**Capture** - Auto-detect corrections during coding sessions via hooks + LLM analysis

**Optimize** - Split monolithic CLAUDE.md into path-scoped rules for selective loading (70-80% context reduction)

**Track** - Staleness scoring, usage analytics, and health auditing

## Install

```bash
npm install -g memman
```

## Quick Start

```bash
# Initialize in your project
memman init

# Sync CLAUDE.md <-> AGENTS.md
memman sync

# Optimize for selective loading
memman optimize

# Health check
memman audit
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `memman init` | Set up memman for a project |
| `memman sync` | Sync CLAUDE.md and AGENTS.md |
| `memman optimize` | Split into path-scoped rules |
| `memman capture memory` | Manually add a memory entry |
| `memman capture correction` | Record a correction |
| `memman stale` | List stale entries |
| `memman audit` | Full health check |
| `memman analytics` | Usage statistics |
| `memman context` | Generate context for hooks |
| `memman serve` | Start MCP server |

## Sync

Bidirectional sync between CLAUDE.md and AGENTS.md:

```bash
# Bidirectional (default)
memman sync

# One direction only
memman sync --direction claude-to-agents
memman sync --direction agents-to-claude

# Preview changes
memman sync --dry-run
```

Managed sections are wrapped in HTML comments so user-authored content is never touched:

```markdown
<!-- memman:start id=synced -->
## Synced from CLAUDE.md
- Always use TypeScript strict mode
<!-- memman:end id=synced -->
```

## Optimize

Split a large CLAUDE.md into path-scoped rules for selective loading:

```bash
memman optimize --dry-run  # Preview the plan
memman optimize            # Execute
```

This creates `.claude/rules/*.md` files with YAML frontmatter:

```yaml
---
paths:
  - tests/**
  - **/*.test.*
---

# Testing Conventions
- Use vitest for unit tests
- Test files should be co-located with source
```

Claude Code loads these rules on-demand only when accessing matching files.

## MCP Server

Start the MCP server for mid-session memory operations:

```bash
memman serve
```

Add to your Claude Code MCP config:

```json
{
  "mcpServers": {
    "memman": {
      "command": "memman",
      "args": ["serve"]
    }
  }
}
```

### MCP Tools

| Tool | Description |
|------|-------------|
| `query_memory` | Search memory by query, category, or paths |
| `save_memory` | Persist a new memory entry |
| `save_correction` | Record a correction with before/after |
| `sync_status` | Check drift between CLAUDE.md and AGENTS.md |
| `suggest_memory` | Get relevant entries for a task |

## Correction Capture

memman captures corrections through multiple channels:

1. **MCP tool** - Claude calls `save_correction` explicitly
2. **Post-edit hook** - Pattern matching flags potential corrections
3. **Session-end hook** - LLM analysis (Claude Haiku, ~$0.001/session) extracts corrections from the full transcript

LLM-powered analysis requires explicit opt-in via two environment variables:

```bash
export ANTHROPIC_API_KEY="sk-..."     # Your API key
export MEMMAN_LLM_ANALYSIS=1          # Explicit opt-in required
```

Without both variables set, only local pattern matching is used. This prevents accidental transmission of transcript content to external APIs.

## Staleness Detection

Multi-factor scoring identifies stale entries:

```bash
memman stale                # Default threshold: 0.5
memman stale --threshold 0.3  # More aggressive
```

Scoring: `staleness = age_factor * (1 - usage_factor) * contradiction_factor`

| Score | Recommendation |
|-------|---------------|
| 0.0 - 0.3 | Fresh |
| 0.3 - 0.6 | Review |
| 0.6 - 0.8 | Demote to topic files |
| 0.8 - 1.0 | Delete |

## Architecture

```
CLI (memman)  ----+
Claude Hooks  ----+--> Core Library --> SQLite DB + Markdown Files
MCP Server    ----+
```

- **SQLite** for metadata, sync state, and usage tracking
- **Markdown files** remain the source of truth for content
- **Hooks** run within 3-second latency budget (no LLM calls in interactive hooks)

## Security Considerations

- **Transcript upload is opt-in.** Session-end LLM analysis sends transcript content to the Anthropic API. This only happens when both `ANTHROPIC_API_KEY` and `MEMMAN_LLM_ANALYSIS=1` are set. Without explicit opt-in, all processing stays local.
- **Corrections are stored locally and re-injected.** Captured corrections are persisted in a local SQLite database and surfaced via `memman context` in future sessions. If a correction accidentally contains a secret (API key, password, etc.), it will be stored and re-surfaced. Review corrections with `memman stale` and remove any that contain sensitive data.
- **The database is local plaintext.** The SQLite database at `~/.claude/memory-manager/memory.db` is not encrypted. Protect it with filesystem permissions as you would any local config file.

## License

MIT
