import { readFileSync, existsSync } from 'node:fs';
import type { ParsedDocument, ParsedSection, ParsedEntry } from '../types.js';

const MANAGED_START_RE = /<!--\s*memman:start\s+id=(\S+)\s*-->/;
const MANAGED_END_RE = /<!--\s*memman:end\s+id=(\S+)\s*-->/;
const HEADING_RE = /^(#{1,6})\s+(.+)$/;
const BULLET_RE = /^(\s*)[-*+]\s+(.+)$/;

export function parseAgentsMd(filePath: string): ParsedDocument {
  if (!existsSync(filePath)) {
    return { sections: [], raw: '', filePath, type: 'agents_md' };
  }

  const raw = readFileSync(filePath, 'utf-8');
  const lines = raw.split('\n');
  const sections: ParsedSection[] = [];

  let currentSection: ParsedSection | null = null;
  let inManagedBlock = false;
  let managedId = '';
  let managedLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for managed block markers
    const startMatch = line.match(MANAGED_START_RE);
    if (startMatch) {
      if (currentSection) {
        currentSection.entries = extractEntries(currentSection.content, currentSection.level);
        sections.push(currentSection);
      }
      inManagedBlock = true;
      managedId = startMatch[1];
      managedLines = [];
      currentSection = null;
      continue;
    }

    const endMatch = line.match(MANAGED_END_RE);
    if (endMatch && inManagedBlock) {
      const managedContent = managedLines.join('\n');
      const heading = managedLines.find(l => HEADING_RE.test(l));
      const headingMatch = heading?.match(HEADING_RE);

      sections.push({
        heading: headingMatch ? headingMatch[2] : undefined,
        level: headingMatch ? headingMatch[1].length : 0,
        content: managedContent,
        entries: extractEntries(managedContent, headingMatch ? headingMatch[1].length : 0),
        managed: true,
        managedId,
      });

      inManagedBlock = false;
      managedId = '';
      managedLines = [];
      continue;
    }

    if (inManagedBlock) {
      managedLines.push(line);
      continue;
    }

    const headingMatch = line.match(HEADING_RE);
    if (headingMatch) {
      if (currentSection) {
        currentSection.entries = extractEntries(currentSection.content, currentSection.level);
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

  if (currentSection) {
    currentSection.entries = extractEntries(currentSection.content, currentSection.level);
    sections.push(currentSection);
  }

  return { sections, raw, filePath, type: 'agents_md' };
}

function extractEntries(content: string, sectionLevel: number): ParsedEntry[] {
  const entries: ParsedEntry[] = [];
  const lines = content.split('\n');
  let currentEntry: string[] = [];
  let currentHeading: string | undefined;

  for (const line of lines) {
    const headingMatch = line.match(HEADING_RE);
    if (headingMatch) {
      currentHeading = headingMatch[2];
      continue;
    }

    const bulletMatch = line.match(BULLET_RE);
    if (bulletMatch) {
      if (bulletMatch[1].length === 0 && currentEntry.length > 0) {
        entries.push(buildEntry(currentEntry.join('\n'), currentHeading, sectionLevel));
        currentEntry = [];
      }
      currentEntry.push(line);
    } else if (currentEntry.length > 0 && line.trim()) {
      currentEntry.push(line);
    } else if (currentEntry.length > 0 && !line.trim()) {
      entries.push(buildEntry(currentEntry.join('\n'), currentHeading, sectionLevel));
      currentEntry = [];
    }
  }

  if (currentEntry.length > 0) {
    entries.push(buildEntry(currentEntry.join('\n'), currentHeading, sectionLevel));
  }

  if (entries.length === 0 && content.trim()) {
    entries.push(buildEntry(content.trim(), currentHeading, sectionLevel));
  }

  return entries;
}

function buildEntry(content: string, heading: string | undefined, level: number): ParsedEntry {
  return {
    content: content.trim(),
    heading,
    level,
    tags: extractTags(content),
  };
}

function extractTags(content: string): string[] {
  const tags: string[] = [];
  const lower = content.toLowerCase();

  if (lower.includes('test')) tags.push('testing');
  if (lower.includes('security') || lower.includes('auth')) tags.push('security');
  if (lower.includes('database') || lower.includes('sql')) tags.push('database');
  if (lower.includes('api') || lower.includes('endpoint')) tags.push('api');
  if (lower.includes('style') || lower.includes('css')) tags.push('frontend');
  if (lower.includes('deploy') || lower.includes('ci')) tags.push('devops');
  if (lower.includes('never') || lower.includes('always') || lower.includes('must')) tags.push('rule');

  return [...new Set(tags)];
}

export function serializeAgentsMd(sections: ParsedSection[]): string {
  const parts: string[] = [];

  for (const section of sections) {
    if (section.managed && section.managedId) {
      parts.push(`<!-- memman:start id=${section.managedId} -->`);
      parts.push(section.content);
      parts.push(`<!-- memman:end id=${section.managedId} -->`);
    } else {
      parts.push(section.content);
    }
  }

  return parts.join('\n\n');
}

export function injectManagedSection(
  existingContent: string,
  managedId: string,
  newContent: string,
): string {
  const startMarker = `<!-- memman:start id=${managedId} -->`;
  const endMarker = `<!-- memman:end id=${managedId} -->`;

  const startIdx = existingContent.indexOf(startMarker);
  const endIdx = existingContent.indexOf(endMarker);

  if (startIdx !== -1 && endIdx !== -1) {
    return (
      existingContent.slice(0, startIdx) +
      startMarker + '\n' +
      newContent + '\n' +
      endMarker +
      existingContent.slice(endIdx + endMarker.length)
    );
  }

  return (
    existingContent.trimEnd() +
    '\n\n' +
    startMarker + '\n' +
    newContent + '\n' +
    endMarker + '\n'
  );
}
