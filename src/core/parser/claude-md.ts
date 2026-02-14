import { readFileSync, existsSync } from 'node:fs';
import { contentHash } from '../hash.js';
import type { ParsedDocument, ParsedSection, ParsedEntry } from '../types.js';

const MANAGED_START_RE = /<!--\s*memman:start\s+id=(\S+)\s*-->/;
const MANAGED_END_RE = /<!--\s*memman:end\s+id=(\S+)\s*-->/;
const HEADING_RE = /^(#{1,6})\s+(.+)$/;
const BULLET_RE = /^(\s*)[-*+]\s+(.+)$/;

export function parseClaudeMd(filePath: string): ParsedDocument {
  if (!existsSync(filePath)) {
    return { sections: [], raw: '', filePath, type: 'claude_md' };
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
      // Flush current section
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

    // Check for headings (new section)
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

    // Append to current section
    if (currentSection) {
      currentSection.content += '\n' + line;
    } else if (line.trim()) {
      // Content before any heading
      currentSection = {
        level: 0,
        content: line,
        entries: [],
        managed: false,
      };
    }
  }

  // Flush last section
  if (currentSection) {
    currentSection.entries = extractEntries(currentSection.content, currentSection.level);
    sections.push(currentSection);
  }

  return { sections, raw, filePath, type: 'claude_md' };
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
      // If we have a previous top-level bullet, flush it
      if (bulletMatch[1].length === 0 && currentEntry.length > 0) {
        entries.push(buildEntry(currentEntry.join('\n'), currentHeading, sectionLevel));
        currentEntry = [];
      }
      currentEntry.push(line);
    } else if (currentEntry.length > 0 && line.trim()) {
      // Continuation of current entry
      currentEntry.push(line);
    } else if (currentEntry.length > 0 && !line.trim()) {
      // Blank line - flush
      entries.push(buildEntry(currentEntry.join('\n'), currentHeading, sectionLevel));
      currentEntry = [];
    }
  }

  if (currentEntry.length > 0) {
    entries.push(buildEntry(currentEntry.join('\n'), currentHeading, sectionLevel));
  }

  // If no bullet entries found, treat the whole section as one entry
  if (entries.length === 0 && content.trim()) {
    entries.push(buildEntry(content.trim(), currentHeading, sectionLevel));
  }

  return entries;
}

function buildEntry(content: string, heading: string | undefined, level: number): ParsedEntry {
  const tags = extractTags(content);
  const paths = extractPaths(content);

  return {
    content: content.trim(),
    heading,
    level,
    tags,
    paths: paths.length > 0 ? paths : undefined,
  };
}

function extractTags(content: string): string[] {
  const tags: string[] = [];
  const lower = content.toLowerCase();

  if (lower.includes('test')) tags.push('testing');
  if (lower.includes('security') || lower.includes('auth')) tags.push('security');
  if (lower.includes('database') || lower.includes('sql') || lower.includes('migration')) tags.push('database');
  if (lower.includes('api') || lower.includes('endpoint') || lower.includes('route')) tags.push('api');
  if (lower.includes('style') || lower.includes('css') || lower.includes('tailwind')) tags.push('frontend');
  if (lower.includes('deploy') || lower.includes('ci') || lower.includes('docker')) tags.push('devops');
  if (lower.includes('never') || lower.includes('always') || lower.includes('must')) tags.push('rule');

  return [...new Set(tags)];
}

function extractPaths(content: string): string[] {
  const paths: string[] = [];
  // Match file paths and glob patterns like src/**/*.ts, tests/**, *.vue
  const pathMatches = content.match(/(?:^|\s)((?:[\w.-]+\/)*[\w.*-]+(?:\/\*\*)?(?:\/[\w.*-]+)?)/gm);
  if (pathMatches) {
    for (const match of pathMatches) {
      const trimmed = match.trim();
      if (trimmed.includes('/') || trimmed.includes('*')) {
        // Filter out common false positives
        if (!trimmed.startsWith('http') && !trimmed.startsWith('//') && trimmed.length < 100) {
          paths.push(trimmed);
        }
      }
    }
  }
  return paths;
}

export function serializeClaudeMd(sections: ParsedSection[]): string {
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
    // Replace existing managed section
    return (
      existingContent.slice(0, startIdx) +
      startMarker + '\n' +
      newContent + '\n' +
      endMarker +
      existingContent.slice(endIdx + endMarker.length)
    );
  }

  // Append new managed section
  return (
    existingContent.trimEnd() +
    '\n\n' +
    startMarker + '\n' +
    newContent + '\n' +
    endMarker + '\n'
  );
}

export function removeManagedSection(content: string, managedId: string): string {
  const startMarker = `<!-- memman:start id=${managedId} -->`;
  const endMarker = `<!-- memman:end id=${managedId} -->`;

  const startIdx = content.indexOf(startMarker);
  const endIdx = content.indexOf(endMarker);

  if (startIdx === -1 || endIdx === -1) return content;

  const before = content.slice(0, startIdx).trimEnd();
  const after = content.slice(endIdx + endMarker.length).trimStart();

  return before + (after ? '\n\n' + after : '\n');
}
