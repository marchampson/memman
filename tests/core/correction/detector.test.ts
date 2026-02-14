import { describe, it, expect } from 'vitest';
import { detectCorrections, detectCorrectionInEdit } from '../../../src/core/correction/detector.js';

describe('detectCorrections', () => {
  it('should detect "actually use X instead of Y" patterns', () => {
    const text = "Actually, use pnpm instead of npm for this project.";
    const corrections = detectCorrections(text);

    expect(corrections.length).toBeGreaterThan(0);
    expect(corrections[0].correct).toContain('pnpm');
    expect(corrections[0].incorrect).toContain('npm');
  });

  it('should detect "don\'t use X, use Y" patterns', () => {
    const text = "Don't use var, use const or let instead.";
    const corrections = detectCorrections(text);

    expect(corrections.length).toBeGreaterThan(0);
    expect(corrections[0].incorrect).toContain('var');
  });

  it('should detect "X is wrong, should be Y" patterns', () => {
    const text = "The port 3000 is wrong, should be 8080.";
    const corrections = detectCorrections(text);

    expect(corrections.length).toBeGreaterThan(0);
    expect(corrections[0].incorrect).toContain('port 3000');
    expect(corrections[0].correct).toContain('8080');
  });

  it('should handle text with no corrections', () => {
    const text = "The quick brown fox jumps over the lazy dog.";
    const corrections = detectCorrections(text);

    expect(corrections.length).toBe(0);
  });

  it('should deduplicate identical corrections', () => {
    const text = "Don't use var, use const. Don't use var, use const.";
    const corrections = detectCorrections(text);

    // Should be deduplicated
    const varCorrections = corrections.filter(c => c.incorrect.includes('var'));
    expect(varCorrections.length).toBe(1);
  });
});

describe('detectCorrectionInEdit', () => {
  it('should detect corrections in line-level edits', () => {
    const oldContent = 'const port = 3000;\nconsole.log("hello");';
    const newContent = 'const port = 8080;\nconsole.log("hello");';

    const corrections = detectCorrectionInEdit('config.ts', oldContent, newContent);

    expect(corrections.length).toBeGreaterThan(0);
    expect(corrections[0].incorrect).toContain('3000');
    expect(corrections[0].correct).toContain('8080');
  });

  it('should not flag complete rewrites', () => {
    const oldContent = 'function foo() { return 1; }';
    const newContent = 'class Bar { constructor() { this.x = 2; } }';

    const corrections = detectCorrectionInEdit('file.ts', oldContent, newContent);

    // Complete rewrite should not be flagged as a correction
    expect(corrections.length).toBe(0);
  });

  it('should handle identical content', () => {
    const content = 'const x = 1;';
    const corrections = detectCorrectionInEdit('file.ts', content, content);

    expect(corrections.length).toBe(0);
  });
});
