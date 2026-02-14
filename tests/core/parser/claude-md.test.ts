import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { parseClaudeMd, serializeClaudeMd, injectManagedSection, removeManagedSection } from '../../../src/core/parser/claude-md.js';

const FIXTURES_DIR = join(__dirname, '../../fixtures');

describe('parseClaudeMd', () => {
  it('should parse a sample CLAUDE.md file', () => {
    const doc = parseClaudeMd(join(FIXTURES_DIR, 'sample-claude.md'));

    expect(doc.sections.length).toBeGreaterThan(0);
    expect(doc.filePath).toContain('sample-claude.md');
    expect(doc.type).toBe('claude_md');
  });

  it('should extract sections with headings', () => {
    const doc = parseClaudeMd(join(FIXTURES_DIR, 'sample-claude.md'));

    const headings = doc.sections
      .filter(s => s.heading)
      .map(s => s.heading);

    expect(headings).toContain('Coding Standards');
    expect(headings).toContain('Testing');
    expect(headings).toContain('Security');
  });

  it('should extract entries from sections', () => {
    const doc = parseClaudeMd(join(FIXTURES_DIR, 'sample-claude.md'));

    const codingSection = doc.sections.find(s => s.heading === 'Coding Standards');
    expect(codingSection).toBeDefined();
    expect(codingSection!.entries.length).toBeGreaterThan(0);

    const firstEntry = codingSection!.entries[0];
    expect(firstEntry.content).toContain('TypeScript strict mode');
  });

  it('should identify managed sections', () => {
    const doc = parseClaudeMd(join(FIXTURES_DIR, 'sample-claude.md'));

    const managed = doc.sections.filter(s => s.managed);
    expect(managed.length).toBe(1);
    expect(managed[0].managedId).toBe('synced');
    expect(managed[0].content).toContain('error handling');
  });

  it('should return empty document for non-existent file', () => {
    const doc = parseClaudeMd('/nonexistent/CLAUDE.md');
    expect(doc.sections).toEqual([]);
    expect(doc.raw).toBe('');
  });

  it('should extract tags from content', () => {
    const doc = parseClaudeMd(join(FIXTURES_DIR, 'sample-claude.md'));

    // The testing section entries should have 'testing' tags
    const testingSection = doc.sections.find(s => s.heading === 'Testing');
    expect(testingSection).toBeDefined();

    const entries = testingSection!.entries;
    const hasTestingTag = entries.some(e => e.tags.includes('testing'));
    expect(hasTestingTag).toBe(true);
  });
});

describe('injectManagedSection', () => {
  it('should inject a new managed section', () => {
    const content = '# My CLAUDE.md\n\n- Rule 1\n- Rule 2';
    const result = injectManagedSection(content, 'test123', '## Test\n- Test entry');

    expect(result).toContain('<!-- memman:start id=test123 -->');
    expect(result).toContain('## Test');
    expect(result).toContain('- Test entry');
    expect(result).toContain('<!-- memman:end id=test123 -->');
  });

  it('should replace an existing managed section', () => {
    const content = `# My CLAUDE.md

<!-- memman:start id=test123 -->
## Old Content
- Old entry
<!-- memman:end id=test123 -->

## Other Section`;

    const result = injectManagedSection(content, 'test123', '## New Content\n- New entry');

    expect(result).toContain('## New Content');
    expect(result).toContain('- New entry');
    expect(result).not.toContain('Old Content');
    expect(result).toContain('## Other Section');
  });
});

describe('removeManagedSection', () => {
  it('should remove a managed section', () => {
    const content = `# My CLAUDE.md

- Rule 1

<!-- memman:start id=test123 -->
## Synced
- Synced entry
<!-- memman:end id=test123 -->

## Other Section`;

    const result = removeManagedSection(content, 'test123');

    expect(result).not.toContain('memman:start');
    expect(result).not.toContain('Synced entry');
    expect(result).toContain('# My CLAUDE.md');
    expect(result).toContain('## Other Section');
  });

  it('should return content unchanged if managed section not found', () => {
    const content = '# My CLAUDE.md\n\n- Rule 1';
    const result = removeManagedSection(content, 'nonexistent');
    expect(result).toBe(content);
  });
});
