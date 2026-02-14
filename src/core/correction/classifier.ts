import type { MemoryCategory } from '../types.js';
import type { CorrectionCandidate } from './detector.js';
import type { ExtractedCorrection } from './extractor.js';

export interface ClassifiedCorrection {
  incorrect: string;
  correct: string;
  category: MemoryCategory;
  paths: string[];
  confidence: number;
  source: 'pattern' | 'llm' | 'manual' | 'mcp';
  isFlipFlop: boolean;
}

export function classifyCorrection(
  candidate: CorrectionCandidate | ExtractedCorrection,
  source: ClassifiedCorrection['source'],
): ClassifiedCorrection {
  const content = `${candidate.incorrect} ${candidate.correct}`.toLowerCase();
  const category = 'category' in candidate
    ? candidate.category
    : inferCategory(content);

  const paths = 'paths' in candidate && Array.isArray(candidate.paths)
    ? candidate.paths
    : extractPaths(content);

  return {
    incorrect: candidate.incorrect,
    correct: candidate.correct,
    category,
    paths,
    confidence: candidate.confidence,
    source,
    isFlipFlop: false,
  };
}

export function detectFlipFlop(
  correction: ClassifiedCorrection,
  existingCorrections: ClassifiedCorrection[],
): boolean {
  // A->B->A pattern: check if there's an existing correction where
  // the "correct" matches our "incorrect" and "incorrect" matches our "correct"
  return existingCorrections.some(existing =>
    normalize(existing.correct) === normalize(correction.incorrect) &&
    normalize(existing.incorrect) === normalize(correction.correct)
  );
}

export function mergeCorrections(
  patternResults: CorrectionCandidate[],
  llmResults: ExtractedCorrection[],
): ClassifiedCorrection[] {
  const classified: ClassifiedCorrection[] = [];
  const seen = new Set<string>();

  // LLM results take precedence (higher quality)
  for (const llm of llmResults) {
    const key = normalize(`${llm.incorrect}|${llm.correct}`);
    if (!seen.has(key)) {
      seen.add(key);
      classified.push(classifyCorrection(llm, 'llm'));
    }
  }

  // Add pattern results that weren't found by LLM
  for (const pattern of patternResults) {
    const key = normalize(`${pattern.incorrect}|${pattern.correct}`);
    if (!seen.has(key)) {
      seen.add(key);
      classified.push(classifyCorrection(pattern, 'pattern'));
    }
  }

  return classified;
}

function inferCategory(content: string): MemoryCategory {
  if (content.includes('test') || content.includes('spec')) return 'testing';
  if (content.includes('security') || content.includes('auth') || content.includes('csrf')) return 'security';
  if (content.includes('api') || content.includes('endpoint') || content.includes('route')) return 'architecture';
  if (content.includes('database') || content.includes('migration') || content.includes('query')) return 'architecture';
  if (content.includes('install') || content.includes('package') || content.includes('dependency')) return 'dependency';
  if (content.includes('deploy') || content.includes('build') || content.includes('ci/cd')) return 'workflow';
  if (content.includes('command') || content.includes('run ') || content.includes('npm ')) return 'command';
  if (content.includes('style') || content.includes('naming') || content.includes('convention')) return 'coding_standard';
  if (content.includes('debug') || content.includes('error') || content.includes('fix')) return 'debugging';
  if (content.includes('prefer') || content.includes('use ')) return 'preference';

  return 'correction';
}

function extractPaths(content: string): string[] {
  const paths: string[] = [];
  const matches = content.match(/(?:[\w.-]+\/)+[\w.*-]+/g);
  if (matches) {
    for (const match of matches) {
      if (!match.startsWith('http') && match.length < 100) {
        paths.push(match);
      }
    }
  }
  return paths;
}

function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, ' ');
}
