import { Command } from 'commander';
import chalk from 'chalk';
import { getDbPath } from '../../core/config.js';
import { MemoryRepository } from '../../core/db/repository.js';

export function analyticsCommand(): Command {
  return new Command('analytics')
    .description('Usage statistics and insights')
    .option('-p, --project <path>', 'Project root path', process.cwd())
    .action(async (options) => {
      const db = new MemoryRepository(getDbPath());

      try {
        const entries = db.getAllEntries();
        const categories = db.getCategoryDistribution();
        const corrections = db.getCorrections();

        console.log(chalk.bold('Memory Analytics\n'));

        // Entry stats
        console.log(chalk.bold('Entries:'));
        console.log(`  Total: ${entries.length}`);

        // Category breakdown
        console.log(chalk.bold('\nCategories:'));
        const sortedCats = Object.entries(categories).sort((a, b) => b[1] - a[1]);
        const maxCount = Math.max(...Object.values(categories), 1);

        for (const [cat, count] of sortedCats) {
          const bar = '█'.repeat(Math.round((count / maxCount) * 20));
          console.log(`  ${cat.padEnd(18)} ${String(count).padStart(4)} ${chalk.cyan(bar)}`);
        }

        // Most used entries
        const sorted = [...entries].sort((a, b) => b.use_count - a.use_count);
        const topUsed = sorted.slice(0, 5);

        if (topUsed.length > 0 && topUsed[0].use_count > 0) {
          console.log(chalk.bold('\nMost Used Entries:'));
          for (const entry of topUsed) {
            if (entry.use_count === 0) break;
            console.log(`  [${entry.use_count}x] ${entry.content.slice(0, 70)}${entry.content.length > 70 ? '...' : ''}`);
          }
        }

        // Least used entries
        const leastUsed = sorted.filter(e => e.use_count === 0).slice(0, 5);
        if (leastUsed.length > 0) {
          console.log(chalk.bold('\nNever Used Entries:'));
          for (const entry of leastUsed) {
            console.log(`  ${chalk.dim(entry.content.slice(0, 70))}${entry.content.length > 70 ? '...' : ''}`);
          }
          const totalNeverUsed = sorted.filter(e => e.use_count === 0).length;
          if (totalNeverUsed > 5) {
            console.log(chalk.dim(`  ...and ${totalNeverUsed - 5} more`));
          }
        }

        // Corrections
        if (corrections.length > 0) {
          console.log(chalk.bold('\nCorrections:'));
          console.log(`  Total: ${corrections.length}`);
          const bySource = corrections.reduce((acc, c) => {
            acc[c.source] = (acc[c.source] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);
          for (const [source, count] of Object.entries(bySource)) {
            console.log(`    ${source}: ${count}`);
          }

          // Recent corrections
          const recent = corrections.slice(0, 3);
          console.log(chalk.bold('\n  Recent Corrections:'));
          for (const c of recent) {
            if (c.incorrect) {
              console.log(`    "${c.incorrect}" → "${c.correct}" (${(c.confidence * 100).toFixed(0)}%)`);
            } else {
              console.log(`    ${c.correct} (${(c.confidence * 100).toFixed(0)}%)`);
            }
          }
        }

        // Scope breakdown
        const scopeCounts = entries.reduce((acc, e) => {
          acc[e.scope.level] = (acc[e.scope.level] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        console.log(chalk.bold('\nScope:'));
        for (const [scope, count] of Object.entries(scopeCounts)) {
          console.log(`  ${scope}: ${count}`);
        }
      } finally {
        db.close();
      }
    });
}
