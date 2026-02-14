import { Command } from 'commander';
import { existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import chalk from 'chalk';
import { resolveConfig, saveConfig, ensureConfigDir, getDbPath } from '../../core/config.js';
import { MemoryRepository } from '../../core/db/repository.js';
import { parseClaudeMd } from '../../core/parser/claude-md.js';
import { parseAgentsMd } from '../../core/parser/agents-md.js';

export function initCommand(): Command {
  return new Command('init')
    .description('Initialize memman for a project')
    .option('-p, --project <path>', 'Project root path', process.cwd())
    .action(async (options) => {
      const projectRoot = options.project;

      console.log(chalk.bold('Initializing memman...\n'));

      // 1. Ensure config directory
      ensureConfigDir();
      console.log(chalk.green('✓') + ' Config directory ready');

      // 2. Create/verify database
      const dbPath = getDbPath();
      const db = new MemoryRepository(dbPath);
      console.log(chalk.green('✓') + ` Database at ${dbPath}`);

      // 3. Scan for existing files
      const config = resolveConfig(projectRoot);

      const claudeMdPath = config.claudeMdPath!;
      const agentsMdPath = config.agentsMdPath!;
      const rulesDir = config.rulesDir!;

      console.log('\nScanning project files...');

      if (existsSync(claudeMdPath)) {
        const doc = parseClaudeMd(claudeMdPath);
        const entryCount = doc.sections.reduce((sum, s) => sum + s.entries.length, 0);
        console.log(chalk.green('✓') + ` Found CLAUDE.md (${doc.sections.length} sections, ${entryCount} entries)`);
      } else {
        console.log(chalk.yellow('○') + ' No CLAUDE.md found (will be created on first sync)');
      }

      if (existsSync(agentsMdPath)) {
        const doc = parseAgentsMd(agentsMdPath);
        const entryCount = doc.sections.reduce((sum, s) => sum + s.entries.length, 0);
        console.log(chalk.green('✓') + ` Found AGENTS.md (${doc.sections.length} sections, ${entryCount} entries)`);
      } else {
        console.log(chalk.yellow('○') + ' No AGENTS.md found (will be created on first sync)');
      }

      if (existsSync(rulesDir)) {
        const ruleFiles = (await import('node:fs')).readdirSync(rulesDir).filter((f: string) => f.endsWith('.md'));
        console.log(chalk.green('✓') + ` Found ${ruleFiles.length} rule files in .claude/rules/`);
      } else {
        console.log(chalk.yellow('○') + ' No .claude/rules/ directory');
      }

      // 4. Check for API key
      if (process.env.ANTHROPIC_API_KEY) {
        console.log(chalk.green('✓') + ' Anthropic API key found (LLM correction analysis enabled)');
        config.llm.enabled = true;
      } else {
        console.log(chalk.yellow('○') + ' No ANTHROPIC_API_KEY set (pattern-only correction detection)');
      }

      // 5. Save config
      saveConfig({
        projectRoot,
        claudeMdPath,
        agentsMdPath,
        rulesDir,
        tokenBudget: config.tokenBudget,
        syncDirection: config.syncDirection,
      });

      console.log(chalk.green('\n✓') + ' Config saved');

      // 6. Summary
      console.log(chalk.bold('\n📋 Next steps:'));
      console.log('  • Run ' + chalk.cyan('memman sync') + ' to sync CLAUDE.md ↔ AGENTS.md');
      console.log('  • Run ' + chalk.cyan('memman optimize') + ' to split into path-scoped rules');
      console.log('  • Run ' + chalk.cyan('memman audit') + ' for a health check');
      console.log('  • Run ' + chalk.cyan('memman serve') + ' to start the MCP server');

      db.close();
    });
}
