import { Command } from 'commander';
import chalk from 'chalk';
import { resolveConfig } from '../../core/config.js';
import { parseClaudeMd } from '../../core/parser/claude-md.js';
import { planSplit, executeSplit } from '../../core/optimizer/splitter.js';
import { analyzeProjectStructure } from '../../core/optimizer/path-mapper.js';

export function optimizeCommand(): Command {
  return new Command('optimize')
    .description('Split CLAUDE.md into path-scoped rules for selective loading')
    .option('-p, --project <path>', 'Project root path', process.cwd())
    .option('--dry-run', 'Preview the split plan without writing files', false)
    .action(async (options) => {
      const config = resolveConfig(options.project);
      const claudeMdPath = config.claudeMdPath!;

      console.log(chalk.bold('Optimizing memory layout...\n'));

      // Parse existing CLAUDE.md
      const doc = parseClaudeMd(claudeMdPath);
      if (doc.sections.length === 0) {
        console.log(chalk.yellow('No CLAUDE.md found or file is empty.'));
        return;
      }

      // Analyze project structure
      console.log('Analyzing project structure...');
      const structure = analyzeProjectStructure(config.projectRoot);

      console.log(`  Directories: ${structure.directories.length}`);
      console.log(`  Has tests: ${structure.hasTests ? chalk.green('yes') : 'no'}`);
      console.log(`  Has frontend: ${structure.hasFrontend ? chalk.green('yes') : 'no'}`);
      console.log(`  Has Docker: ${structure.hasDocker ? chalk.green('yes') : 'no'}`);
      console.log(`  Has CI: ${structure.hasCi ? chalk.green('yes') : 'no'}`);

      // Create split plan
      console.log('\nPlanning optimization...');
      const plan = planSplit(doc.sections);

      console.log(chalk.bold('\nSplit Plan:'));
      console.log(`  Original tokens:      ${chalk.red(String(plan.originalTokens))}`);
      console.log(`  Always-loaded tokens: ${chalk.green(String(plan.optimizedAlwaysLoadedTokens))}`);
      console.log(`  Token reduction:      ${chalk.green(Math.round((1 - plan.optimizedAlwaysLoadedTokens / Math.max(plan.originalTokens, 1)) * 100) + '%')}`);

      console.log(`\n  Always-loaded entries: ${plan.alwaysLoaded.reduce((s, sec) => s + sec.entries.length, 0)}`);
      console.log(`  Rule files to create: ${plan.rules.length}`);

      for (const rule of plan.rules) {
        const pathLabel = rule.paths.length > 0
          ? chalk.cyan(rule.paths.join(', '))
          : chalk.yellow('(unconditional)');
        console.log(`    • ${rule.name}.md [${rule.entries.length} entries, ~${rule.tokenEstimate} tokens] → ${pathLabel}`);
      }

      if (plan.topicFiles.length > 0) {
        console.log(`  Topic files: ${plan.topicFiles.length}`);
        for (const topic of plan.topicFiles) {
          console.log(`    • ${topic.name}.md [${topic.entries.length} entries, ~${topic.tokenEstimate} tokens]`);
        }
      }

      if (options.dryRun) {
        console.log(chalk.yellow('\nDry run complete. No files were modified.'));
        return;
      }

      // Execute the split
      console.log('\nWriting files...');
      const result = executeSplit(plan, config.projectRoot, claudeMdPath);

      console.log(chalk.bold('\nResults:'));
      console.log(`  Files created/updated: ${result.files.length}`);
      for (const file of result.files) {
        console.log(`    ${file.path} (~${file.tokenCount} tokens)`);
      }

      console.log(chalk.green('\n✓ Optimization complete'));
      console.log(`  Always-loaded context reduced by ${chalk.green(Math.round((1 - result.optimizedTokens / Math.max(result.originalTokens, 1)) * 100) + '%')}`);
    });
}
