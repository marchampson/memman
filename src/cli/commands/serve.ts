import { Command } from 'commander';
import chalk from 'chalk';

export function serveCommand(): Command {
  return new Command('serve')
    .description('Start the MCP server')
    .option('-p, --project <path>', 'Project root path', process.cwd())
    .action(async (options) => {
      console.log(chalk.bold('Starting MCP server...\n'));
      console.log(`  Project: ${options.project}`);
      console.log(`  Transport: stdio\n`);

      // Dynamic import to avoid loading MCP deps when not needed
      const { startServer } = await import('../../mcp/server.js');
      await startServer(options.project);
    });
}
