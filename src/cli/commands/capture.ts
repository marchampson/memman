import { Command } from 'commander';
import chalk from 'chalk';
import { resolveConfig, getDbPath } from '../../core/config.js';
import { MemoryRepository } from '../../core/db/repository.js';
import { captureCorrection } from '../../core/correction/pipeline.js';
import { contentHash } from '../../core/hash.js';
import type { MemoryCategory } from '../../core/types.js';

export function captureCommand(): Command {
  const cmd = new Command('capture')
    .description('Manually capture a memory entry or correction');

  cmd
    .command('memory')
    .description('Add a new memory entry')
    .requiredOption('-c, --content <text>', 'The memory content')
    .option('--category <cat>', 'Category', 'convention')
    .option('--paths <paths...>', 'File path patterns this applies to')
    .option('--tags <tags...>', 'Tags for the entry')
    .option('-p, --project <path>', 'Project root path', process.cwd())
    .action(async (options) => {
      const config = resolveConfig(options.project);
      const db = new MemoryRepository(getDbPath());

      try {
        const entry = db.createEntry({
          content: options.content,
          category: options.category as MemoryCategory,
          scope: { level: 'project', project: config.projectRoot },
          paths: options.paths,
          source: { type: 'manual', file_path: '' },
          targets: [],
          tags: options.tags || [],
          content_hash: contentHash(options.content),
          supersedes: undefined,
        });

        console.log(chalk.green('✓') + ` Memory entry created: ${entry.id}`);
        console.log(`  Category: ${entry.category}`);
        console.log(`  Content: ${entry.content.slice(0, 80)}${entry.content.length > 80 ? '...' : ''}`);
      } finally {
        db.close();
      }
    });

  cmd
    .command('correction')
    .description('Record a correction')
    .requiredOption('--incorrect <text>', 'What was wrong')
    .requiredOption('--correct <text>', 'What is correct')
    .option('--category <cat>', 'Category', 'correction')
    .option('--paths <paths...>', 'File path patterns this applies to')
    .option('-p, --project <path>', 'Project root path', process.cwd())
    .action(async (options) => {
      const db = new MemoryRepository(getDbPath());

      try {
        const correction = captureCorrection(
          options.incorrect,
          options.correct,
          options.category as MemoryCategory,
          options.paths,
          'manual',
          { db },
        );

        console.log(chalk.green('✓') + ` Correction captured: ${correction.id}`);
        console.log(`  Incorrect: ${correction.incorrect}`);
        console.log(`  Correct: ${correction.correct}`);
      } finally {
        db.close();
      }
    });

  return cmd;
}
