import { defineConfig } from 'tsup';

export default defineConfig([
  // CLI entry (with shebang)
  {
    entry: {
      'cli/index': 'src/cli/index.ts',
    },
    format: ['esm'],
    target: 'node18',
    platform: 'node',
    sourcemap: true,
    clean: true,
    splitting: false,
    banner: {
      js: '#!/usr/bin/env node',
    },
    external: ['better-sqlite3', '@anthropic-ai/sdk', '@modelcontextprotocol/sdk'],
  },
  // Core library and MCP server (no shebang)
  {
    entry: {
      'core/index': 'src/core/index.ts',
      'mcp/server': 'src/mcp/server.ts',
    },
    format: ['esm'],
    target: 'node18',
    platform: 'node',
    dts: true,
    sourcemap: true,
    splitting: false,
    external: ['better-sqlite3', '@anthropic-ai/sdk', '@modelcontextprotocol/sdk'],
  },
]);
