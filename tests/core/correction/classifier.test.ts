import { describe, it, expect } from 'vitest';
import { classifyCorrection, detectFlipFlop, mergeCorrections } from '../../../src/core/correction/classifier.js';
import type { CorrectionCandidate } from '../../../src/core/correction/detector.js';
import type { ExtractedCorrection } from '../../../src/core/correction/extractor.js';

describe('classifyCorrection', () => {
  it('should classify a pattern-based correction', () => {
    const candidate: CorrectionCandidate = {
      incorrect: 'npm install',
      correct: 'pnpm install',
      context: 'Use pnpm instead of npm',
      confidence: 0.8,
      source: 'pattern',
    };

    const result = classifyCorrection(candidate, 'pattern');

    expect(result.source).toBe('pattern');
    expect(result.incorrect).toBe('npm install');
    expect(result.correct).toBe('pnpm install');
    expect(result.isFlipFlop).toBe(false);
  });

  it('should use category from LLM extraction', () => {
    const extracted: ExtractedCorrection = {
      incorrect: 'var x = 1',
      correct: 'const x = 1',
      category: 'coding_standard',
      paths: [],
      confidence: 0.9,
    };

    const result = classifyCorrection(extracted, 'llm');

    expect(result.category).toBe('coding_standard');
  });
});

describe('detectFlipFlop', () => {
  it('should detect A->B->A flip-flop', () => {
    const existing = [
      {
        incorrect: 'npm',
        correct: 'pnpm',
        category: 'command' as const,
        paths: [],
        confidence: 0.8,
        source: 'pattern' as const,
        isFlipFlop: false,
      },
    ];

    // New correction reverses the previous one (pnpm -> npm)
    const newCorrection = {
      incorrect: 'pnpm',
      correct: 'npm',
      category: 'command' as const,
      paths: [],
      confidence: 0.8,
      source: 'pattern' as const,
      isFlipFlop: false,
    };

    expect(detectFlipFlop(newCorrection, existing)).toBe(true);
  });

  it('should not flag non-flip-flop corrections', () => {
    const existing = [
      {
        incorrect: 'npm',
        correct: 'pnpm',
        category: 'command' as const,
        paths: [],
        confidence: 0.8,
        source: 'pattern' as const,
        isFlipFlop: false,
      },
    ];

    const newCorrection = {
      incorrect: 'yarn',
      correct: 'pnpm',
      category: 'command' as const,
      paths: [],
      confidence: 0.8,
      source: 'pattern' as const,
      isFlipFlop: false,
    };

    expect(detectFlipFlop(newCorrection, existing)).toBe(false);
  });
});

describe('mergeCorrections', () => {
  it('should prioritize LLM results over pattern results', () => {
    const patterns: CorrectionCandidate[] = [
      {
        incorrect: 'use npm',
        correct: 'use pnpm',
        context: '',
        confidence: 0.6,
        source: 'pattern',
      },
    ];

    const llm: ExtractedCorrection[] = [
      {
        incorrect: 'use npm',
        correct: 'use pnpm',
        category: 'command',
        paths: [],
        confidence: 0.9,
      },
    ];

    const merged = mergeCorrections(patterns, llm);

    // Should only have one entry (LLM takes precedence)
    expect(merged.length).toBe(1);
    expect(merged[0].source).toBe('llm');
    expect(merged[0].confidence).toBe(0.9);
  });

  it('should include pattern-only results', () => {
    const patterns: CorrectionCandidate[] = [
      {
        incorrect: 'var',
        correct: 'const',
        context: '',
        confidence: 0.7,
        source: 'pattern',
      },
    ];

    const llm: ExtractedCorrection[] = [
      {
        incorrect: 'npm',
        correct: 'pnpm',
        category: 'command',
        paths: [],
        confidence: 0.9,
      },
    ];

    const merged = mergeCorrections(patterns, llm);

    expect(merged.length).toBe(2);
    expect(merged.find(c => c.incorrect === 'var')).toBeDefined();
    expect(merged.find(c => c.incorrect === 'npm')).toBeDefined();
  });
});
