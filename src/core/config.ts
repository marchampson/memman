import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { homedir } from 'node:os';
import type { MemmanConfig, SyncDirection } from './types.js';

const CONFIG_DIR = join(homedir(), '.claude', 'memory-manager');
const CONFIG_FILE = 'config.json';
const DB_FILE = 'memory.db';

export function getConfigDir(): string {
  return CONFIG_DIR;
}

export function getDbPath(): string {
  return join(CONFIG_DIR, DB_FILE);
}

export function resolveConfig(projectRoot?: string): MemmanConfig {
  const root = projectRoot ? resolve(projectRoot) : process.cwd();
  const configPath = join(CONFIG_DIR, CONFIG_FILE);

  // Default config
  const config: MemmanConfig = {
    dbPath: getDbPath(),
    projectRoot: root,
    tokenBudget: 32768,
    syncDirection: 'bidirectional',
    llm: {
      enabled: false,
      model: 'claude-haiku-4-5-20251001',
    },
  };

  // Load saved config if exists
  if (existsSync(configPath)) {
    try {
      const saved = JSON.parse(readFileSync(configPath, 'utf-8'));
      Object.assign(config, saved);
    } catch {
      // Ignore invalid config
    }
  }

  // Resolve file paths based on project root
  config.claudeMdPath = config.claudeMdPath ?? findClaudeMd(root);
  config.agentsMdPath = config.agentsMdPath ?? findAgentsMd(root);
  config.rulesDir = config.rulesDir ?? join(root, '.claude', 'rules');

  // Check for API key
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    config.llm.enabled = true;
    config.llm.apiKey = apiKey;
  }

  return config;
}

export function saveConfig(config: Partial<MemmanConfig>): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }

  const configPath = join(CONFIG_DIR, CONFIG_FILE);
  const existing = existsSync(configPath)
    ? JSON.parse(readFileSync(configPath, 'utf-8'))
    : {};

  // Don't save sensitive data
  const toSave = { ...existing, ...config };
  delete toSave.llm?.apiKey;

  writeFileSync(configPath, JSON.stringify(toSave, null, 2), 'utf-8');
}

export function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

function findClaudeMd(projectRoot: string): string {
  // Check in order of preference
  const candidates = [
    join(projectRoot, 'CLAUDE.md'),
    join(projectRoot, '.claude', 'CLAUDE.md'),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  // Default to project root
  return join(projectRoot, 'CLAUDE.md');
}

function findAgentsMd(projectRoot: string): string {
  const candidate = join(projectRoot, 'AGENTS.md');
  return candidate;
}
