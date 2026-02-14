import { readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

export interface ProjectStructure {
  directories: string[];
  fileExtensions: Map<string, number>;
  hasTests: boolean;
  testPatterns: string[];
  hasFrontend: boolean;
  frontendPatterns: string[];
  hasBackend: boolean;
  backendPatterns: string[];
  hasConfig: boolean;
  hasDocker: boolean;
  hasCi: boolean;
}

/**
 * Analyze codebase structure to improve path mapping accuracy
 */
export function analyzeProjectStructure(projectRoot: string, maxDepth = 4): ProjectStructure {
  const structure: ProjectStructure = {
    directories: [],
    fileExtensions: new Map(),
    hasTests: false,
    testPatterns: [],
    hasFrontend: false,
    frontendPatterns: [],
    hasBackend: false,
    backendPatterns: [],
    hasConfig: false,
    hasDocker: false,
    hasCi: false,
  };

  walkDirectory(projectRoot, projectRoot, structure, 0, maxDepth);

  return structure;
}

function walkDirectory(
  dir: string,
  root: string,
  structure: ProjectStructure,
  depth: number,
  maxDepth: number,
): void {
  if (depth > maxDepth) return;

  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }

  for (const entry of entries) {
    // Skip common non-project directories
    if (shouldSkip(entry)) continue;

    const fullPath = join(dir, entry);
    const relPath = relative(root, fullPath);

    let stat;
    try {
      stat = statSync(fullPath);
    } catch {
      continue;
    }

    if (stat.isDirectory()) {
      structure.directories.push(relPath);

      // Detect project features from directory names
      const lower = entry.toLowerCase();
      if (lower === 'tests' || lower === 'test' || lower === '__tests__' || lower === 'spec') {
        structure.hasTests = true;
        structure.testPatterns.push(`${relPath}/**`);
      }
      if (['components', 'views', 'pages', 'layouts', 'assets', 'public'].includes(lower)) {
        structure.hasFrontend = true;
        structure.frontendPatterns.push(`${relPath}/**`);
      }
      if (['controllers', 'services', 'middleware', 'routes', 'api'].includes(lower)) {
        structure.hasBackend = true;
        structure.backendPatterns.push(`${relPath}/**`);
      }
      if (lower === 'config' || lower === 'configuration') {
        structure.hasConfig = true;
      }
      if (lower === '.github') {
        structure.hasCi = true;
      }

      walkDirectory(fullPath, root, structure, depth + 1, maxDepth);
    } else {
      const ext = extname(entry);
      if (ext) {
        structure.fileExtensions.set(ext, (structure.fileExtensions.get(ext) || 0) + 1);
      }

      // Detect features from file names
      if (entry.includes('.test.') || entry.includes('.spec.')) {
        structure.hasTests = true;
      }
      if (entry === 'Dockerfile' || entry.startsWith('docker-compose')) {
        structure.hasDocker = true;
      }
      if (entry.endsWith('.vue') || entry.endsWith('.tsx') || entry.endsWith('.jsx')) {
        structure.hasFrontend = true;
      }
    }
  }
}

/**
 * Given a project structure, suggest path-scoped rules
 */
export function suggestRulePaths(structure: ProjectStructure): Map<string, string[]> {
  const suggestions = new Map<string, string[]>();

  if (structure.hasTests && structure.testPatterns.length > 0) {
    suggestions.set('testing', [
      ...structure.testPatterns,
      '**/*.test.*',
      '**/*.spec.*',
    ]);
  }

  if (structure.hasFrontend && structure.frontendPatterns.length > 0) {
    const frontendExts = [];
    if (structure.fileExtensions.has('.vue')) frontendExts.push('**/*.vue');
    if (structure.fileExtensions.has('.tsx')) frontendExts.push('**/*.tsx');
    if (structure.fileExtensions.has('.jsx')) frontendExts.push('**/*.jsx');
    if (structure.fileExtensions.has('.css')) frontendExts.push('**/*.css');
    if (structure.fileExtensions.has('.scss')) frontendExts.push('**/*.scss');

    suggestions.set('frontend', [
      ...structure.frontendPatterns,
      ...frontendExts,
    ]);
  }

  if (structure.hasBackend && structure.backendPatterns.length > 0) {
    suggestions.set('backend', structure.backendPatterns);
  }

  if (structure.hasDocker) {
    suggestions.set('docker', ['Dockerfile', 'docker-compose.*', '.dockerignore']);
  }

  if (structure.hasCi) {
    suggestions.set('ci', ['.github/**']);
  }

  return suggestions;
}

function shouldSkip(name: string): boolean {
  return [
    'node_modules', '.git', 'vendor', 'dist', 'build',
    '.next', '.nuxt', '__pycache__', '.cache',
    'coverage', '.idea', '.vscode',
  ].includes(name);
}
