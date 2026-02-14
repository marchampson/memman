import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { parseRuleFile, generateRuleFile } from '../../../src/core/parser/rules.js';

const FIXTURES_DIR = join(__dirname, '../../fixtures');

describe('parseRuleFile', () => {
  it('should parse a rule file with paths frontmatter', () => {
    const rule = parseRuleFile(join(FIXTURES_DIR, 'sample-rule.md'));

    expect(rule.name).toBe('sample-rule');
    expect(rule.isConditional).toBe(true);
    expect(rule.paths).toEqual(['tests/**', '**/*.test.*', '**/*.spec.*']);
    expect(rule.body).toContain('Testing Conventions');
  });

  it('should extract rule body without frontmatter', () => {
    const rule = parseRuleFile(join(FIXTURES_DIR, 'sample-rule.md'));

    expect(rule.body).not.toContain('---');
    expect(rule.body).not.toContain('paths:');
    expect(rule.body).toContain('describe');
  });
});

describe('generateRuleFile', () => {
  it('should generate a rule file with paths', () => {
    const output = generateRuleFile(
      'testing',
      ['tests/**', '**/*.test.*'],
      '- Always use describe blocks\n- Mock external services',
    );

    expect(output).toContain('---');
    expect(output).toContain('paths:');
    expect(output).toContain('  - tests/**');
    expect(output).toContain('  - **/*.test.*');
    expect(output).toContain('Always use describe blocks');
  });

  it('should generate a rule file without paths (unconditional)', () => {
    const output = generateRuleFile(
      'security',
      [],
      '- Never commit secrets',
    );

    expect(output).toContain('---');
    expect(output).not.toContain('paths:');
    expect(output).toContain('Never commit secrets');
  });
});
