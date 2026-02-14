export interface CorrectionCandidate {
  incorrect: string;
  correct: string;
  context: string;
  confidence: number;
  source: 'pattern' | 'llm';
}

// Patterns that indicate corrections in conversation/edits
const CORRECTION_PATTERNS: { pattern: RegExp; extract: (match: RegExpMatchArray) => Partial<CorrectionCandidate> }[] = [
  {
    // "Actually, use X instead of Y"
    pattern: /(?:actually|no),?\s+(?:use|it'?s|we should use|prefer)\s+(.+?)\s+(?:instead of|not|rather than)\s+(.+?)(?:\.|$)/gi,
    extract: (m) => ({ correct: m[1], incorrect: m[2], confidence: 0.8 }),
  },
  {
    // "Don't use X, use Y"
    pattern: /(?:don'?t|do not|never)\s+use\s+(.+?),?\s+(?:use|prefer)\s+(.+?)(?:\.|$)/gi,
    extract: (m) => ({ incorrect: m[1], correct: m[2], confidence: 0.85 }),
  },
  {
    // "X is wrong/incorrect, should be Y"
    pattern: /(.+?)\s+(?:is|was)\s+(?:wrong|incorrect|outdated|deprecated),?\s+(?:should be|use|it'?s)\s+(.+?)(?:\.|$)/gi,
    extract: (m) => ({ incorrect: m[1], correct: m[2], confidence: 0.75 }),
  },
  {
    // "Changed X to Y" / "Renamed X to Y"
    pattern: /(?:changed?|renamed?|updated?|replaced?|switched?)\s+(.+?)\s+(?:to|with)\s+(.+?)(?:\.|$)/gi,
    extract: (m) => ({ incorrect: m[1], correct: m[2], confidence: 0.6 }),
  },
  {
    // "The correct way is X"
    pattern: /the\s+(?:correct|right|proper)\s+(?:way|approach|method|pattern)\s+(?:is|to)\s+(.+?)(?:\.|$)/gi,
    extract: (m) => ({ correct: m[1], confidence: 0.5 }),
  },
  {
    // "Stop using X" / "We no longer use X"
    pattern: /(?:stop using|no longer use|deprecated|removed)\s+(.+?)(?:\.|,|$)/gi,
    extract: (m) => ({ incorrect: m[1], confidence: 0.7 }),
  },
];

export function detectCorrections(text: string): CorrectionCandidate[] {
  const candidates: CorrectionCandidate[] = [];

  for (const { pattern, extract } of CORRECTION_PATTERNS) {
    // Reset lastIndex for global regex
    pattern.lastIndex = 0;

    let match;
    while ((match = pattern.exec(text)) !== null) {
      const extracted = extract(match);
      candidates.push({
        incorrect: extracted.incorrect ?? '',
        correct: extracted.correct ?? '',
        context: getContext(text, match.index!, 200),
        confidence: extracted.confidence ?? 0.5,
        source: 'pattern',
      });
    }
  }

  return deduplicateCandidates(candidates);
}

export function detectCorrectionInEdit(
  filePath: string,
  oldContent: string,
  newContent: string,
): CorrectionCandidate[] {
  const candidates: CorrectionCandidate[] = [];

  // Simple line-level diff
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');

  // Find removed and added lines
  const removed = oldLines.filter(l => !newLines.includes(l) && l.trim());
  const added = newLines.filter(l => !oldLines.includes(l) && l.trim());

  // If there's a 1:1 correspondence of removed->added, it may be a correction
  if (removed.length > 0 && added.length > 0 && removed.length <= 3 && added.length <= 3) {
    for (let i = 0; i < Math.min(removed.length, added.length); i++) {
      const sim = wordSimilarity(removed[i], added[i]);
      // Only flag if lines are similar enough to be corrections (not complete rewrites)
      if (sim > 0.3 && sim < 0.95) {
        candidates.push({
          incorrect: removed[i].trim(),
          correct: added[i].trim(),
          context: `File: ${filePath}`,
          confidence: sim * 0.6, // Conservative confidence
          source: 'pattern',
        });
      }
    }
  }

  return candidates;
}

function getContext(text: string, index: number, radius: number): string {
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + radius);
  return text.slice(start, end).trim();
}

function deduplicateCandidates(candidates: CorrectionCandidate[]): CorrectionCandidate[] {
  const seen = new Set<string>();
  return candidates.filter(c => {
    const key = `${c.incorrect}|${c.correct}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function wordSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\W+/).filter(w => w.length > 1));
  const wordsB = new Set(b.toLowerCase().split(/\W+/).filter(w => w.length > 1));

  if (wordsA.size === 0 && wordsB.size === 0) return 1;
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let intersection = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) intersection++;
  }

  const union = wordsA.size + wordsB.size - intersection;
  return intersection / union;
}
