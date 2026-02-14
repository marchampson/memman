import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { resolveConfig, getDbPath } from '../core/config.js';
import { MemoryRepository } from '../core/db/repository.js';
import { contentHash } from '../core/hash.js';
import { captureCorrection } from '../core/correction/pipeline.js';
import { getSyncDrift } from '../core/sync/engine.js';
import type { MemoryCategory } from '../core/types.js';

export async function startServer(projectRoot?: string): Promise<void> {
  const config = resolveConfig(projectRoot);
  const db = new MemoryRepository(getDbPath());

  const server = new McpServer({
    name: 'memman',
    version: '0.1.0',
  });

  // Tool: query_memory
  server.tool(
    'query_memory',
    'Search memory entries by query, category, or file paths',
    {
      query: z.string().optional().describe('Search query text'),
      category: z.string().optional().describe('Filter by category'),
      paths: z.array(z.string()).optional().describe('Filter by file paths'),
      limit: z.number().optional().default(10).describe('Max results'),
    },
    async ({ query, category, paths, limit }) => {
      let entries;

      if (query) {
        entries = db.searchEntries(query, limit);
      } else if (paths && paths.length > 0) {
        entries = db.getEntriesByPaths(paths);
      } else {
        entries = db.getAllEntries({ category: category as MemoryCategory });
      }

      // Track usage
      for (const entry of entries.slice(0, limit)) {
        db.incrementUseCount(entry.id, `mcp:query_memory:${query || category || ''}`);
      }

      const results = entries.slice(0, limit).map(e => ({
        id: e.id,
        content: e.content,
        category: e.category,
        paths: e.paths,
        tags: e.tags,
        use_count: e.use_count,
      }));

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(results, null, 2),
        }],
      };
    },
  );

  // Tool: save_memory
  server.tool(
    'save_memory',
    'Save a new memory entry',
    {
      content: z.string().describe('The memory content'),
      category: z.string().optional().default('convention').describe('Category'),
      paths: z.array(z.string()).optional().describe('File path patterns'),
      tags: z.array(z.string()).optional().describe('Tags'),
    },
    async ({ content, category, paths, tags }) => {
      const entry = db.createEntry({
        content,
        category: category as MemoryCategory,
        scope: { level: 'project', project: config.projectRoot },
        paths: paths ?? undefined,
        source: { type: 'manual', file_path: '' },
        targets: [],
        tags: tags ?? [],
        content_hash: contentHash(content),
        supersedes: undefined,
      });

      return {
        content: [{
          type: 'text' as const,
          text: `Memory saved: ${entry.id}\nCategory: ${entry.category}\nContent: ${entry.content}`,
        }],
      };
    },
  );

  // Tool: save_correction
  server.tool(
    'save_correction',
    'Record a correction (something that was wrong and what is correct)',
    {
      incorrect: z.string().describe('What was incorrect'),
      correct: z.string().describe('What is correct'),
      category: z.string().optional().default('correction').describe('Category'),
      paths: z.array(z.string()).optional().describe('Relevant file paths'),
    },
    async ({ incorrect, correct, category, paths }) => {
      const correction = captureCorrection(
        incorrect,
        correct,
        category as MemoryCategory,
        paths,
        'mcp',
        { db },
      );

      return {
        content: [{
          type: 'text' as const,
          text: `Correction saved: ${correction.id}\n"${incorrect}" → "${correct}"\nConfidence: ${(correction.confidence * 100).toFixed(0)}%`,
        }],
      };
    },
  );

  // Tool: sync_status
  server.tool(
    'sync_status',
    'Check sync drift between CLAUDE.md and AGENTS.md',
    {},
    async () => {
      if (!config.claudeMdPath || !config.agentsMdPath) {
        return {
          content: [{
            type: 'text' as const,
            text: 'No CLAUDE.md or AGENTS.md configured. Run `memman init` first.',
          }],
        };
      }

      const drift = getSyncDrift(config.claudeMdPath, config.agentsMdPath, db);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            in_sync: !drift.drifted,
            claude_md_changed: drift.claudeChanged,
            agents_md_changed: drift.agentsChanged,
            claude_md_path: config.claudeMdPath,
            agents_md_path: config.agentsMdPath,
          }, null, 2),
        }],
      };
    },
  );

  // Tool: suggest_memory
  server.tool(
    'suggest_memory',
    'Given a task description, suggest relevant memory entries',
    {
      task: z.string().describe('Description of the current task'),
      files: z.array(z.string()).optional().describe('Files being worked on'),
    },
    async ({ task, files }) => {
      const suggestions: Array<{ content: string; category: string; relevance: string }> = [];

      // Search by task keywords
      const keywords = task.toLowerCase().split(/\W+/).filter(w => w.length > 3);
      const seen = new Set<string>();

      for (const keyword of keywords.slice(0, 5)) {
        const matches = db.searchEntries(keyword, 5);
        for (const match of matches) {
          if (!seen.has(match.id)) {
            seen.add(match.id);
            suggestions.push({
              content: match.content,
              category: match.category,
              relevance: `keyword: ${keyword}`,
            });
            db.incrementUseCount(match.id, `mcp:suggest:${keyword}`);
          }
        }
      }

      // Search by file paths
      if (files && files.length > 0) {
        const pathMatches = db.getEntriesByPaths(files);
        for (const match of pathMatches) {
          if (!seen.has(match.id)) {
            seen.add(match.id);
            suggestions.push({
              content: match.content,
              category: match.category,
              relevance: `path match`,
            });
            db.incrementUseCount(match.id, `mcp:suggest:path`);
          }
        }
      }

      return {
        content: [{
          type: 'text' as const,
          text: suggestions.length > 0
            ? JSON.stringify(suggestions.slice(0, 10), null, 2)
            : 'No relevant memories found for this task.',
        }],
      };
    },
  );

  // Start the server
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
