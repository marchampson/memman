import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import type { ParsedDocument, ParsedSection, ParsedEntry } from '../types.js';

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n/;
const PATHS_RE = /^paths:\s*\n((?:\s+-\s+.+\n?)*)/m;
const SINGLE_PATH_RE = /^\s+-\s+(.+)$/gm;
const HEADING_RE = /^(#{1,6})\s+(.+)$/;

export interface RuleFile {
  filePath: string;
  name: string;
  paths: string[];
  content: string;
  frontmatter: string;
  body: string;
  isConditional: boolean;
}

export function parseRulesDir(rulesDir: string): RuleFile[] {
  if (!existsSync(rulesDir)) return [];

  const files = readdirSync(rulesDir).filter(f => f.endsWith('.md'));
  return files.map(f => parseRuleFile(join(rulesDir, f)));
}

export function parseRuleFile(filePath: string): RuleFile {
  const raw = readFileSync(filePath, 'utf-8');
  const name = basename(filePath, '.md');

  const frontmatterMatch = raw.match(FRONTMATTER_RE);
  let frontmatter = '';
  let body = raw;
  let paths: string[] = [];

  if (frontmatterMatch) {
    frontmatter = frontmatterMatch[1];
    body = raw.slice(frontmatterMatch[0].length);

    const pathsMatch = frontmatter.match(PATHS_RE);
    if (pathsMatch) {
      let match;
      while ((match = SINGLE_PATH_RE.exec(pathsMatch[1])) !== null) {
        paths.push(match[1].trim());
      }
    }
  }

  return {
    filePath,
    name,
    paths,
    content: raw,
    frontmatter,
    body: body.trim(),
    isConditional: paths.length > 0,
  };
}

export function generateRuleFile(name: string, paths: string[], content: string): string {
  let output = '---\n';

  if (paths.length > 0) {
    output += 'paths:\n';
    for (const p of paths) {
      output += `  - ${p}\n`;
    }
  }

  output += `---\n\n${content.trim()}\n`;
  return output;
}

export function ruleFileToDocument(rule: RuleFile): ParsedDocument {
  const sections: ParsedSection[] = [];
  const lines = rule.body.split('\n');
  let currentSection: ParsedSection | null = null;

  for (const line of lines) {
    const headingMatch = line.match(HEADING_RE);
    if (headingMatch) {
      if (currentSection) {
        sections.push(currentSection);
      }
      currentSection = {
        heading: headingMatch[2],
        level: headingMatch[1].length,
        content: line,
        entries: [],
        managed: false,
      };
      continue;
    }

    if (currentSection) {
      currentSection.content += '\n' + line;
    } else if (line.trim()) {
      currentSection = {
        level: 0,
        content: line,
        entries: [],
        managed: false,
      };
    }
  }

  if (currentSection) sections.push(currentSection);

  // Extract entries from each section
  for (const section of sections) {
    section.entries = extractEntriesFromContent(section.content, section.level);
  }

  return {
    sections,
    raw: rule.content,
    filePath: rule.filePath,
    type: 'claude_rule',
  };
}

function extractEntriesFromContent(content: string, level: number): ParsedEntry[] {
  const entries: ParsedEntry[] = [];
  const lines = content.split('\n');
  let currentEntry: string[] = [];

  for (const line of lines) {
    if (/^[-*+]\s/.test(line)) {
      if (currentEntry.length > 0) {
        entries.push({ content: currentEntry.join('\n').trim(), level, tags: [] });
        currentEntry = [];
      }
      currentEntry.push(line);
    } else if (currentEntry.length > 0 && line.trim()) {
      currentEntry.push(line);
    } else if (currentEntry.length > 0) {
      entries.push({ content: currentEntry.join('\n').trim(), level, tags: [] });
      currentEntry = [];
    }
  }

  if (currentEntry.length > 0) {
    entries.push({ content: currentEntry.join('\n').trim(), level, tags: [] });
  }

  if (entries.length === 0 && content.trim()) {
    entries.push({ content: content.trim(), level, tags: [] });
  }

  return entries;
}
