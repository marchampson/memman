import { Command } from 'commander';
import { existsSync, readFileSync } from 'node:fs';
import chalk from 'chalk';
import { resolveConfig, getDbPath } from '../../core/config.js';
import { MemoryRepository } from '../../core/db/repository.js';
import { scoreAllEntries } from '../../core/staleness/scorer.js';
import { getSyncDrift } from '../../core/sync/engine.js';
import { estimateTokens } from '../../core/optimizer/analyzer.js';
import type { AuditResult, AuditIssue, MemoryCategory } from '../../core/types.js';

export function auditCommand(): Command {
  return new Command('audit')
    .description('Full health check of memory system')
    .option('-p, --project <path>', 'Project root path', process.cwd())
    .action(async (options) => {
      const config = resolveConfig(options.project);
      const db = new MemoryRepository(getDbPath());

      try {
        console.log(chalk.bold('Memory System Audit\n'));

        const issues: AuditIssue[] = [];

        // 1. Entry statistics
        const entries = db.getAllEntries();
        const categories = db.getCategoryDistribution();
        console.log(chalk.bold('📊 Entries:'));
        console.log(`  Total: ${entries.length}`);
        for (const [cat, count] of Object.entries(categories)) {
          console.log(`    ${cat}: ${count}`);
        }
        console.log('');

        // 2. Staleness
        const stalenessResults = scoreAllEntries(db, config.projectRoot);
        const staleCount = stalenessResults.filter(r => r.score >= 0.5).length;
        const veryStaleCount = stalenessResults.filter(r => r.score >= 0.8).length;

        console.log(chalk.bold('⏰ Staleness:'));
        console.log(`  Fresh (< 0.3): ${stalenessResults.filter(r => r.score < 0.3).length}`);
        console.log(`  Needs review (0.3-0.6): ${stalenessResults.filter(r => r.score >= 0.3 && r.score < 0.6).length}`);
        console.log(`  Should demote (0.6-0.8): ${stalenessResults.filter(r => r.score >= 0.6 && r.score < 0.8).length}`);
        console.log(`  Should delete (> 0.8): ${veryStaleCount}`);

        if (veryStaleCount > 0) {
          issues.push({ severity: 'warning', message: `${veryStaleCount} entries are very stale and should be deleted` });
        }
        console.log('');

        // 3. Sync drift
        console.log(chalk.bold('🔄 Sync Status:'));
        if (config.claudeMdPath && config.agentsMdPath) {
          const claudeExists = existsSync(config.claudeMdPath);
          const agentsExists = existsSync(config.agentsMdPath);

          console.log(`  CLAUDE.md: ${claudeExists ? chalk.green('exists') : chalk.red('missing')}`);
          console.log(`  AGENTS.md: ${agentsExists ? chalk.green('exists') : chalk.red('missing')}`);

          if (claudeExists && agentsExists) {
            const drift = getSyncDrift(config.claudeMdPath, config.agentsMdPath, db);
            if (drift.drifted) {
              console.log(chalk.yellow('  ⚠ Files are out of sync'));
              if (drift.claudeChanged) console.log('    CLAUDE.md has been modified since last sync');
              if (drift.agentsChanged) console.log('    AGENTS.md has been modified since last sync');
              issues.push({ severity: 'warning', message: 'CLAUDE.md and AGENTS.md are out of sync' });
            } else {
              console.log(chalk.green('  ✓ Files are in sync'));
            }
          } else {
            if (!claudeExists && !agentsExists) {
              issues.push({ severity: 'info', message: 'Neither CLAUDE.md nor AGENTS.md exist' });
            } else if (!agentsExists) {
              issues.push({ severity: 'info', message: 'No AGENTS.md found - run `memman sync` to create' });
            }
          }
        }
        console.log('');

        // 4. Token budget
        console.log(chalk.bold('📏 Token Budget:'));
        let totalTokens = 0;

        if (config.claudeMdPath && existsSync(config.claudeMdPath)) {
          const content = readFileSync(config.claudeMdPath, 'utf-8');
          const tokens = estimateTokens(content);
          totalTokens += tokens;
          console.log(`  CLAUDE.md: ~${tokens} tokens`);
        }

        if (config.agentsMdPath && existsSync(config.agentsMdPath)) {
          const content = readFileSync(config.agentsMdPath, 'utf-8');
          const tokens = estimateTokens(content);
          console.log(`  AGENTS.md: ~${tokens} tokens`);
        }

        const budgetPct = Math.round((totalTokens / config.tokenBudget) * 100);
        const budgetColor = budgetPct > 80 ? chalk.red : budgetPct > 50 ? chalk.yellow : chalk.green;
        console.log(`  Budget usage: ${budgetColor(budgetPct + '%')} (${totalTokens}/${config.tokenBudget})`);

        if (budgetPct > 80) {
          issues.push({ severity: 'warning', message: `Token budget at ${budgetPct}% - consider running \`memman optimize\`` });
        }
        console.log('');

        // 5. Corrections
        const corrections = db.getCorrections();
        console.log(chalk.bold('🔧 Corrections:'));
        console.log(`  Total captured: ${corrections.length}`);
        const highConf = corrections.filter(c => c.confidence >= 0.7).length;
        const lowConf = corrections.filter(c => c.confidence < 0.5).length;
        console.log(`  High confidence: ${highConf}`);
        console.log(`  Low confidence: ${lowConf}`);
        console.log('');

        // 6. Issues summary
        if (issues.length > 0) {
          console.log(chalk.bold('⚠ Issues:'));
          for (const issue of issues) {
            const icon = issue.severity === 'error' ? chalk.red('✗')
              : issue.severity === 'warning' ? chalk.yellow('⚠')
              : chalk.blue('ℹ');
            console.log(`  ${icon} ${issue.message}`);
          }
        } else {
          console.log(chalk.green('✓ No issues found'));
        }
      } finally {
        db.close();
      }
    });
}
