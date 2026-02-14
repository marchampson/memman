import type { ParsedEntry, ParsedSection, MemoryCategory } from '../types.js';

export type EntryClassification = 'always_load' | 'path_scoped' | 'domain_specific' | 'rare';

export interface AnalyzedEntry {
  entry: ParsedEntry;
  classification: EntryClassification;
  suggestedPaths: string[];
  domain?: string;
  tokenEstimate: number;
}

/**
 * Analyze entries from a CLAUDE.md and classify them for selective loading
 */
export function analyzeEntries(sections: ParsedSection[]): AnalyzedEntry[] {
  const analyzed: AnalyzedEntry[] = [];

  for (const section of sections) {
    if (section.managed) continue; // Skip managed sections

    for (const entry of section.entries) {
      const classification = classifyEntry(entry, section);
      const suggestedPaths = inferPaths(entry, section);
      const domain = inferDomain(entry, section);

      analyzed.push({
        entry,
        classification,
        suggestedPaths,
        domain,
        tokenEstimate: estimateTokens(entry.content),
      });
    }
  }

  return analyzed;
}

function classifyEntry(entry: ParsedEntry, section: ParsedSection): EntryClassification {
  const content = entry.content.toLowerCase();
  const heading = (section.heading || '').toLowerCase();

  // Critical rules should always be loaded
  if (isCriticalRule(content)) return 'always_load';

  // If the entry already has path patterns, it's path-scoped
  if (entry.paths && entry.paths.length > 0) return 'path_scoped';

  // Check if it maps to specific file patterns
  const pathPatterns = inferPaths(entry, section);
  if (pathPatterns.length > 0) return 'path_scoped';

  // Domain-specific entries (testing, frontend, etc.)
  if (isDomainSpecific(content, heading)) return 'domain_specific';

  // Default: rare (historical/specific knowledge)
  if (content.length > 200) return 'rare';

  return 'always_load';
}

function isCriticalRule(content: string): boolean {
  // Security, core conventions, fundamental architecture decisions
  if (content.includes('never') && (content.includes('commit') || content.includes('push') || content.includes('expose'))) return true;
  if (content.includes('security') && content.includes('must')) return true;
  if (content.includes('always') && content.includes('must')) return true;
  if (content.includes('critical') || content.includes('important')) return true;
  if (content.includes('.env') || content.includes('secret') || content.includes('credential')) return true;

  return false;
}

function isDomainSpecific(content: string, heading: string): boolean {
  const domains = ['testing', 'frontend', 'backend', 'database', 'deployment', 'ci/cd', 'api', 'auth'];
  return domains.some(d => content.includes(d) || heading.includes(d));
}

function inferPaths(entry: ParsedEntry, section: ParsedSection): string[] {
  const paths: string[] = [];
  const content = entry.content.toLowerCase();
  const heading = (section.heading || '').toLowerCase();

  // Map domain keywords to file patterns
  const pathMappings: [RegExp, string[]][] = [
    [/\btest(?:s|ing)?\b/, ['tests/**', '**/*.test.*', '**/*.spec.*']],
    [/\bvue\b/, ['**/*.vue']],
    [/\breact\b|\.tsx\b|\.jsx\b/, ['**/*.tsx', '**/*.jsx']],
    [/\bcss\b|\btailwind\b|\bstyle/, ['**/*.css', '**/*.scss', 'tailwind.config.*']],
    [/\bmigration/, ['database/migrations/**']],
    [/\bmodel\b/, ['app/Models/**', 'src/models/**']],
    [/\bcontroller\b/, ['app/Http/Controllers/**', 'src/controllers/**']],
    [/\bmiddleware\b/, ['app/Http/Middleware/**', 'src/middleware/**']],
    [/\broute\b|\brouting\b/, ['routes/**', 'src/routes/**']],
    [/\bconfig(?:uration)?\b/, ['config/**', '*.config.*']],
    [/\bdocker\b/, ['Dockerfile', 'docker-compose.*']],
    [/\bci\b|\bgithub.actions?\b/, ['.github/**']],
    [/\bpackage\.json\b|\bdependenc/, ['package.json', 'composer.json']],
  ];

  for (const [pattern, filePaths] of pathMappings) {
    if (pattern.test(content) || pattern.test(heading)) {
      paths.push(...filePaths);
    }
  }

  return [...new Set(paths)];
}

function inferDomain(entry: ParsedEntry, section: ParsedSection): string | undefined {
  const content = entry.content.toLowerCase();
  const heading = (section.heading || '').toLowerCase();
  const combined = `${content} ${heading}`;

  if (/\btest/.test(combined)) return 'testing';
  if (/\bfrontend|\bvue|\breact|\bcss/.test(combined)) return 'frontend';
  if (/\bbackend|\bapi|\bserver/.test(combined)) return 'backend';
  if (/\bdatabase|\bsql|\bmigration/.test(combined)) return 'database';
  if (/\bdeploy|\bci|\bdocker/.test(combined)) return 'devops';
  if (/\bsecurity|\bauth/.test(combined)) return 'security';

  return undefined;
}

// Rough token estimation: ~4 chars per token for English text
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
