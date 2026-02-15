import { Command } from 'commander';
import { resolveConfig, getDbPath } from '../../core/config.js';
import { MemoryRepository } from '../../core/db/repository.js';

function toBullet(content: string): string {
  const stripped = content.replace(/^[\s]*[-*+]\s+/, '');
  return `- ${stripped}`;
}

export function contextCommand(): Command {
  return new Command('context')
    .description('Generate context for hook injection')
    .option('-p, --project <path>', 'Project root path', process.cwd())
    .option('-q, --query <text>', 'Query to match against')
    .option('--files <files...>', 'Files being accessed (for path-based matching)')
    .option('--max-tokens <n>', 'Maximum tokens to output', '500')
    .action(async (options) => {
      const config = resolveConfig(options.project);
      const db = new MemoryRepository(getDbPath());

      try {
        const maxTokens = parseInt(options.maxTokens);
        const contextParts: string[] = [];
        let tokenCount = 0;

        // Priority 1: Recent corrections (high confidence)
        const corrections = db.getCorrections({ minConfidence: 0.7, limit: 5 });
        if (corrections.length > 0) {
          contextParts.push('## Recent Corrections');
          for (const c of corrections) {
            const line = c.incorrect
              ? `- "${c.incorrect}" → "${c.correct}"`
              : `- ${c.correct}`;
            const lineTokens = Math.ceil(line.length / 4);
            if (tokenCount + lineTokens > maxTokens) break;
            contextParts.push(line);
            tokenCount += lineTokens;
          }
        }

        // Priority 2: Query-matched entries
        if (options.query && tokenCount < maxTokens) {
          const matches = db.searchEntries(options.query, 10);
          if (matches.length > 0) {
            contextParts.push('\n## Relevant Conventions');
            for (const entry of matches) {
              const lineTokens = Math.ceil(entry.content.length / 4);
              if (tokenCount + lineTokens > maxTokens) break;
              contextParts.push(toBullet(entry.content));
              tokenCount += lineTokens;
              db.incrementUseCount(entry.id, `context:${options.query}`);
            }
          }
        }

        // Priority 3: Path-matched entries
        if (options.files && options.files.length > 0 && tokenCount < maxTokens) {
          const pathMatched = db.getEntriesByPaths(options.files);
          if (pathMatched.length > 0) {
            contextParts.push('\n## File-specific Notes');
            for (const entry of pathMatched) {
              const lineTokens = Math.ceil(entry.content.length / 4);
              if (tokenCount + lineTokens > maxTokens) break;
              contextParts.push(toBullet(entry.content));
              tokenCount += lineTokens;
              db.incrementUseCount(entry.id, `context:path:${options.files.join(',')}`);
            }
          }
        }

        // Output the context (for hooks to pipe into Claude)
        if (contextParts.length > 0) {
          process.stdout.write(contextParts.join('\n') + '\n');
        }
      } finally {
        db.close();
      }
    });
}
