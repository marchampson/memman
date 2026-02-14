import { Command } from 'commander';
import chalk from 'chalk';
import { resolveConfig, getDbPath } from '../../core/config.js';
import { MemoryRepository } from '../../core/db/repository.js';
import { sync } from '../../core/sync/engine.js';
import type { SyncDirection } from '../../core/types.js';

export function syncCommand(): Command {
  return new Command('sync')
    .description('Sync CLAUDE.md and AGENTS.md bidirectionally')
    .option('-d, --direction <dir>', 'Sync direction: bidirectional, claude-to-agents, agents-to-claude', 'bidirectional')
    .option('--dry-run', 'Preview changes without writing', false)
    .option('-p, --project <path>', 'Project root path', process.cwd())
    .action(async (options) => {
      const config = resolveConfig(options.project);
      const db = new MemoryRepository(getDbPath());

      const direction = options.direction as SyncDirection;

      console.log(chalk.bold('Syncing memory files...\n'));
      console.log(`  Direction: ${chalk.cyan(direction)}`);
      console.log(`  CLAUDE.md: ${config.claudeMdPath}`);
      console.log(`  AGENTS.md: ${config.agentsMdPath}`);

      if (options.dryRun) {
        console.log(chalk.yellow('  Mode: DRY RUN\n'));
      } else {
        console.log('');
      }

      try {
        const result = sync({
          claudeMdPath: config.claudeMdPath!,
          agentsMdPath: config.agentsMdPath!,
          direction,
          dryRun: options.dryRun,
          projectRoot: config.projectRoot,
          db,
        });

        console.log(chalk.bold('Results:'));
        console.log(`  Entries added:   ${chalk.green(String(result.entriesAdded))}`);
        console.log(`  Entries updated: ${chalk.blue(String(result.entriesUpdated))}`);
        console.log(`  Entries removed: ${chalk.red(String(result.entriesRemoved))}`);

        if (result.conflicts.length > 0) {
          console.log(chalk.yellow(`\n⚠ ${result.conflicts.length} conflict(s) detected:`));
          for (const conflict of result.conflicts) {
            console.log(`\n  Entry: ${conflict.entryId}`);
            console.log(`  Source: ${conflict.sourceContent.slice(0, 80)}...`);
            console.log(`  Target: ${conflict.targetContent.slice(0, 80)}...`);
          }
          console.log(chalk.yellow('\nResolve conflicts manually, then re-run sync.'));
        }

        if (options.dryRun) {
          console.log(chalk.yellow('\nDry run complete. No files were modified.'));
        } else {
          console.log(chalk.green('\n✓ Sync complete'));
        }
      } catch (err) {
        console.error(chalk.red('Error:'), (err as Error).message);
        process.exit(1);
      } finally {
        db.close();
      }
    });
}
