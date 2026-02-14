import { MemoryRepository } from '../db/repository.js';
import { contentHash } from '../hash.js';
import { detectCorrections, detectCorrectionInEdit } from './detector.js';
import { extractCorrectionsWithLLM } from './extractor.js';
import { classifyCorrection, mergeCorrections, detectFlipFlop, type ClassifiedCorrection } from './classifier.js';
import type { Correction, MemoryCategory } from '../types.js';

export interface PipelineOptions {
  db: MemoryRepository;
  apiKey?: string;
  llmModel?: string;
  sessionId?: string;
}

/**
 * Full correction pipeline: detect -> extract (LLM) -> classify -> dedup -> persist
 * Used in SessionEnd hook for batch processing of entire transcript
 */
export async function processTranscript(
  transcript: string,
  options: PipelineOptions,
): Promise<Correction[]> {
  const { db, apiKey, llmModel, sessionId } = options;

  // Step 1: Pattern-based detection
  const patternCandidates = detectCorrections(transcript);

  // Step 2: LLM-powered extraction (if API key available)
  let llmResults: Awaited<ReturnType<typeof extractCorrectionsWithLLM>>['corrections'] = [];
  if (apiKey) {
    try {
      const result = await extractCorrectionsWithLLM(transcript, apiKey, llmModel);
      llmResults = result.corrections;
    } catch {
      // Fallback to pattern-only
    }
  }

  // Step 3: Merge and classify
  const classified = mergeCorrections(patternCandidates, llmResults);

  // Step 4: Dedup against existing corrections and detect flip-flops
  const existingCorrections = db.getCorrections().map(c => classifyCorrection(
    { incorrect: c.incorrect, correct: c.correct, confidence: c.confidence, context: '', source: 'pattern' },
    c.source as ClassifiedCorrection['source'],
  ));

  const newCorrections: Correction[] = [];

  for (const correction of classified) {
    // Check for duplicates
    const hash = contentHash(`${correction.incorrect}|${correction.correct}`);
    const existing = db.getEntryByHash(hash);
    if (existing) continue;

    // Check for flip-flops
    correction.isFlipFlop = detectFlipFlop(correction, existingCorrections);

    // Persist to DB
    const persisted = db.createCorrection({
      incorrect: correction.incorrect,
      correct: correction.correct,
      category: correction.category,
      paths: correction.paths.length > 0 ? correction.paths : undefined,
      confidence: correction.confidence,
      source: correction.source === 'llm' ? 'hook_llm' : 'hook_pattern',
      session_id: sessionId,
    });

    // Also create a memory entry for high-confidence corrections
    if (correction.confidence >= 0.7 && !correction.isFlipFlop) {
      const memoryContent = correction.incorrect
        ? `Correction: "${correction.incorrect}" should be "${correction.correct}"`
        : `Note: ${correction.correct}`;

      const entry = db.createEntry({
        content: memoryContent,
        category: correction.category,
        scope: { level: 'project' },
        paths: correction.paths.length > 0 ? correction.paths : undefined,
        source: { type: 'correction_capture', file_path: '' },
        targets: [],
        tags: ['correction', 'auto-captured'],
        content_hash: contentHash(memoryContent),
        supersedes: undefined,
      });

      persisted.memory_entry_id = entry.id;
    }

    newCorrections.push(persisted);
  }

  return newCorrections;
}

/**
 * Quick correction capture from an edit operation
 * Used in PostToolUse hook for real-time flagging
 */
export function processEdit(
  filePath: string,
  oldContent: string,
  newContent: string,
  options: PipelineOptions,
): Correction[] {
  const candidates = detectCorrectionInEdit(filePath, oldContent, newContent);
  const corrections: Correction[] = [];

  for (const candidate of candidates) {
    if (candidate.confidence < 0.4) continue;

    const hash = contentHash(`${candidate.incorrect}|${candidate.correct}`);
    const existing = options.db.getEntryByHash(hash);
    if (existing) continue;

    const persisted = options.db.createCorrection({
      incorrect: candidate.incorrect,
      correct: candidate.correct,
      category: 'correction',
      paths: [filePath],
      confidence: candidate.confidence,
      source: 'hook_pattern',
      session_id: options.sessionId,
    });

    corrections.push(persisted);
  }

  return corrections;
}

/**
 * Manual correction capture via MCP or CLI
 */
export function captureCorrection(
  incorrect: string,
  correct: string,
  category: MemoryCategory,
  paths: string[] | undefined,
  source: 'mcp' | 'manual',
  options: PipelineOptions,
): Correction {
  const { db, sessionId } = options;

  const correction = db.createCorrection({
    incorrect,
    correct,
    category,
    paths,
    confidence: 1.0, // Manual captures are always high confidence
    source,
    session_id: sessionId,
  });

  // Always create a memory entry for manual corrections
  const memoryContent = incorrect
    ? `Correction: "${incorrect}" should be "${correct}"`
    : `Note: ${correct}`;

  const entry = db.createEntry({
    content: memoryContent,
    category,
    scope: { level: 'project' },
    paths,
    source: { type: 'correction_capture', file_path: '' },
    targets: [],
    tags: ['correction', source],
    content_hash: contentHash(memoryContent),
    supersedes: undefined,
  });

  correction.memory_entry_id = entry.id;
  return correction;
}
