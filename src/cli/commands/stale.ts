import { Command } from 'commander';
import chalk from 'chalk';
import { resolveConfig, getDbPath } from '../../core/config.js';
import { MemoryRepository } from '../../core/db/repository.js';
import { getStaleEntries } from '../../core/staleness/scorer.js';

export function staleCommand(): Command {
  return new Command('stale')
    .description('List stale memory entries')
    .option('-t, --threshold <number>', 'Staleness threshold (0.0-1.0)', '0.5')
    .option('-p, --project <path>', 'Project root path', process.cwd())
    .action(async (options) => {
      const config = resolveConfig(options.project);
      const db = new MemoryRepository(getDbPath());

      try {
        const threshold = parseFloat(options.threshold);
        const results = getStaleEntries(db, threshold, config.projectRoot);

        if (results.length === 0) {
          console.log(chalk.green('No stale entries found above threshold ' + threshold));
          return;
        }

        console.log(chalk.bold(`Found ${results.length} stale entries (threshold: ${threshold}):\n`));

        for (const result of results) {
          const color = result.recommendation === 'delete' ? chalk.red
            : result.recommendation === 'demote' ? chalk.yellow
            : chalk.blue;

          console.log(color(`[${result.score.toFixed(2)}] ${result.recommendation.toUpperCase()}`));
          console.log(`  ID: ${result.entry.id}`);
          console.log(`  Content: ${result.entry.content.slice(0, 100)}${result.entry.content.length > 100 ? '...' : ''}`);
          console.log(`  Category: ${result.entry.category}`);
          console.log(`  Factors: age=${result.factors.age.toFixed(2)} usage=${result.factors.usage.toFixed(2)} contradiction=${result.factors.contradiction.toFixed(2)}`);
          console.log(`  Last updated: ${result.entry.updated_at}`);
          console.log(`  Used ${result.entry.use_count} times`);
          console.log('');
        }

        const deleteCount = results.filter(r => r.recommendation === 'delete').length;
        const demoteCount = results.filter(r => r.recommendation === 'demote').length;
        const reviewCount = results.filter(r => r.recommendation === 'review').length;

        console.log(chalk.bold('Summary:'));
        if (deleteCount > 0) console.log(chalk.red(`  ${deleteCount} suggested for deletion`));
        if (demoteCount > 0) console.log(chalk.yellow(`  ${demoteCount} suggested for demotion to topic files`));
        if (reviewCount > 0) console.log(chalk.blue(`  ${reviewCount} flagged for review`));
      } finally {
        db.close();
      }
    });
}
