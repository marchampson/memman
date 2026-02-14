import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { syncCommand } from './commands/sync.js';
import { optimizeCommand } from './commands/optimize.js';
import { captureCommand } from './commands/capture.js';
import { staleCommand } from './commands/stale.js';
import { auditCommand } from './commands/audit.js';
import { analyticsCommand } from './commands/analytics.js';
import { contextCommand } from './commands/context.js';
import { serveCommand } from './commands/serve.js';

const program = new Command();

program
  .name('memman')
  .description('Unified memory manager for AI coding assistants')
  .version('0.1.0');

program.addCommand(initCommand());
program.addCommand(syncCommand());
program.addCommand(optimizeCommand());
program.addCommand(captureCommand());
program.addCommand(staleCommand());
program.addCommand(auditCommand());
program.addCommand(analyticsCommand());
program.addCommand(contextCommand());
program.addCommand(serveCommand());

program.parse();
