import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { analyzeEntries, estimateTokens, type AnalyzedEntry } from './analyzer.js';
import { generateRuleFile } from '../parser/rules.js';
import { serializeClaudeMd } from '../parser/claude-md.js';
import type { ParsedSection, ParsedEntry, OptimizeResult } from '../types.js';

export interface SplitPlan {
  alwaysLoaded: ParsedSection[];
  rules: RulePlan[];
  topicFiles: TopicPlan[];
  originalTokens: number;
  optimizedAlwaysLoadedTokens: number;
}

export interface RulePlan {
  name: string;
  paths: string[];
  entries: ParsedEntry[];
  tokenEstimate: number;
}

export interface TopicPlan {
  name: string;
  domain: string;
  entries: ParsedEntry[];
  tokenEstimate: number;
}

/**
 * Plan how to split a CLAUDE.md into optimized files
 */
export function planSplit(sections: ParsedSection[]): SplitPlan {
  const analyzed = analyzeEntries(sections);

  const alwaysLoaded: ParsedEntry[] = [];
  const pathScoped = new Map<string, AnalyzedEntry[]>();
  const domainGrouped = new Map<string, AnalyzedEntry[]>();
  const rare: AnalyzedEntry[] = [];

  for (const item of analyzed) {
    switch (item.classification) {
      case 'always_load':
        alwaysLoaded.push(item.entry);
        break;
      case 'path_scoped': {
        const key = item.suggestedPaths.sort().join(',');
        if (!pathScoped.has(key)) pathScoped.set(key, []);
        pathScoped.get(key)!.push(item);
        break;
      }
      case 'domain_specific': {
        const domain = item.domain || 'general';
        if (!domainGrouped.has(domain)) domainGrouped.set(domain, []);
        domainGrouped.get(domain)!.push(item);
        break;
      }
      case 'rare':
        rare.push(item);
        break;
    }
  }

  // Build rule plans from path-scoped entries
  const rules: RulePlan[] = [];
  for (const [pathKey, items] of pathScoped) {
    const paths = pathKey.split(',');
    const name = inferRuleName(paths, items);
    rules.push({
      name,
      paths,
      entries: items.map(i => i.entry),
      tokenEstimate: items.reduce((sum, i) => sum + i.tokenEstimate, 0),
    });
  }

  // Domain-specific entries can also become path-scoped rules
  for (const [domain, items] of domainGrouped) {
    const paths = items.flatMap(i => i.suggestedPaths);
    const uniquePaths = [...new Set(paths)];

    if (uniquePaths.length > 0) {
      rules.push({
        name: domain,
        paths: uniquePaths,
        entries: items.map(i => i.entry),
        tokenEstimate: items.reduce((sum, i) => sum + i.tokenEstimate, 0),
      });
    } else {
      // No path patterns - becomes a topic file
      // (always loaded as unconditional rule)
      rules.push({
        name: domain,
        paths: [], // No paths = unconditional rule, always loaded
        entries: items.map(i => i.entry),
        tokenEstimate: items.reduce((sum, i) => sum + i.tokenEstimate, 0),
      });
    }
  }

  // Build topic plans from rare entries
  const topicFiles: TopicPlan[] = [];
  if (rare.length > 0) {
    topicFiles.push({
      name: 'historical',
      domain: 'historical',
      entries: rare.map(i => i.entry),
      tokenEstimate: rare.reduce((sum, i) => sum + i.tokenEstimate, 0),
    });
  }

  // Build the always-loaded section
  const alwaysLoadedSection: ParsedSection = {
    heading: undefined,
    level: 0,
    content: alwaysLoaded.map(e => e.content).join('\n\n'),
    entries: alwaysLoaded,
    managed: false,
  };

  const originalTokens = analyzed.reduce((sum, i) => sum + i.tokenEstimate, 0);
  const optimizedAlwaysLoadedTokens = alwaysLoaded.reduce(
    (sum, e) => sum + estimateTokens(e.content), 0
  );

  return {
    alwaysLoaded: [alwaysLoadedSection],
    rules,
    topicFiles,
    originalTokens,
    optimizedAlwaysLoadedTokens,
  };
}

/**
 * Execute the split plan, writing files to disk
 */
export function executeSplit(
  plan: SplitPlan,
  projectRoot: string,
  claudeMdPath: string,
): OptimizeResult {
  const rulesDir = join(projectRoot, '.claude', 'rules');
  const files: { path: string; tokenCount: number }[] = [];

  // Write optimized CLAUDE.md (always-loaded content only)
  const claudeMdContent = plan.alwaysLoaded
    .map(s => s.content)
    .join('\n\n')
    .trim();

  writeFileSync(claudeMdPath, claudeMdContent + '\n', 'utf-8');
  const claudeTokens = estimateTokens(claudeMdContent);
  files.push({ path: claudeMdPath, tokenCount: claudeTokens });

  // Write rule files
  if (!existsSync(rulesDir)) {
    mkdirSync(rulesDir, { recursive: true });
  }

  for (const rule of plan.rules) {
    const content = rule.entries.map(e => e.content).join('\n\n');
    const ruleContent = generateRuleFile(rule.name, rule.paths, content);
    const rulePath = join(rulesDir, `${rule.name}.md`);

    writeFileSync(rulePath, ruleContent, 'utf-8');
    files.push({ path: rulePath, tokenCount: rule.tokenEstimate });
  }

  // Write topic files (auto memory)
  for (const topic of plan.topicFiles) {
    const autoMemDir = join(
      process.env.HOME || '~',
      '.claude',
      'projects',
      projectRoot.replace(/\//g, '-'),
      'memory',
    );

    if (!existsSync(autoMemDir)) {
      mkdirSync(autoMemDir, { recursive: true });
    }

    const content = `# ${topic.name}\n\n` + topic.entries.map(e => e.content).join('\n\n');
    const topicPath = join(autoMemDir, `${topic.name}.md`);

    writeFileSync(topicPath, content + '\n', 'utf-8');
    files.push({ path: topicPath, tokenCount: topic.tokenEstimate });
  }

  const pathScopedTokens = plan.rules
    .filter(r => r.paths.length > 0)
    .reduce((sum, r) => sum + r.tokenEstimate, 0);

  return {
    originalTokens: plan.originalTokens,
    optimizedTokens: plan.optimizedAlwaysLoadedTokens,
    rulesCreated: plan.rules.length,
    alwaysLoadedEntries: plan.alwaysLoaded.reduce((sum, s) => sum + s.entries.length, 0),
    pathScopedEntries: plan.rules.reduce((sum, r) => sum + r.entries.length, 0),
    files,
  };
}

function inferRuleName(paths: string[], items: AnalyzedEntry[]): string {
  // Try to infer a name from the paths
  if (paths.some(p => p.includes('test'))) return 'testing';
  if (paths.some(p => p.includes('.vue'))) return 'vue';
  if (paths.some(p => p.includes('.tsx') || p.includes('.jsx'))) return 'react';
  if (paths.some(p => p.includes('.css') || p.includes('tailwind'))) return 'styling';
  if (paths.some(p => p.includes('migration'))) return 'database';
  if (paths.some(p => p.includes('Controller'))) return 'controllers';
  if (paths.some(p => p.includes('Model'))) return 'models';
  if (paths.some(p => p.includes('route'))) return 'routing';
  if (paths.some(p => p.includes('.github'))) return 'ci';
  if (paths.some(p => p.includes('docker') || p.includes('Docker'))) return 'docker';
  if (paths.some(p => p.includes('config'))) return 'config';

  // Fallback: use the domain from the first item
  const domain = items[0]?.domain;
  if (domain) return domain;

  return 'misc';
}
