import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { contentHash } from '../hash.js';
import type { ParsedEntry, ParsedSection } from '../types.js';

export function writeManagedSection(
  filePath: string,
  managedId: string,
  heading: string,
  entries: ParsedEntry[],
): void {
  ensureDir(filePath);

  const startMarker = `<!-- memman:start id=${managedId} -->`;
  const endMarker = `<!-- memman:end id=${managedId} -->`;

  const sectionContent = formatEntries(heading, entries);
  const existing = existsSync(filePath) ? readFileSync(filePath, 'utf-8') : '';

  const startIdx = existing.indexOf(startMarker);
  const endIdx = existing.indexOf(endMarker);

  let output: string;

  if (startIdx !== -1 && endIdx !== -1) {
    // Replace existing managed section
    output =
      existing.slice(0, startIdx) +
      startMarker + '\n' +
      sectionContent + '\n' +
      endMarker +
      existing.slice(endIdx + endMarker.length);
  } else {
    // Append new managed section
    output =
      existing.trimEnd() +
      '\n\n' +
      startMarker + '\n' +
      sectionContent + '\n' +
      endMarker + '\n';
  }

  writeFileSync(filePath, output, 'utf-8');
}

export function removeManagedSectionFromFile(filePath: string, managedId: string): void {
  if (!existsSync(filePath)) return;

  const content = readFileSync(filePath, 'utf-8');
  const startMarker = `<!-- memman:start id=${managedId} -->`;
  const endMarker = `<!-- memman:end id=${managedId} -->`;

  const startIdx = content.indexOf(startMarker);
  const endIdx = content.indexOf(endMarker);

  if (startIdx === -1 || endIdx === -1) return;

  const before = content.slice(0, startIdx).trimEnd();
  const after = content.slice(endIdx + endMarker.length).trimStart();

  const output = before + (after ? '\n\n' + after : '\n');
  writeFileSync(filePath, output, 'utf-8');
}

export function writeFullFile(filePath: string, sections: ParsedSection[]): void {
  ensureDir(filePath);

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

  writeFileSync(filePath, parts.join('\n\n') + '\n', 'utf-8');
}

function formatEntries(heading: string, entries: ParsedEntry[]): string {
  const lines: string[] = [];

  if (heading) {
    lines.push(`## ${heading}`);
    lines.push('');
  }

  for (const entry of entries) {
    // If entry already starts with a bullet, use as-is
    if (/^[-*+]\s/.test(entry.content)) {
      lines.push(entry.content);
    } else {
      lines.push(`- ${entry.content}`);
    }
  }

  return lines.join('\n');
}

function ensureDir(filePath: string): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}
