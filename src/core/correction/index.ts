export { detectCorrections, detectCorrectionInEdit } from './detector.js';
export type { CorrectionCandidate } from './detector.js';
export { extractCorrectionsWithLLM } from './extractor.js';
export type { ExtractedCorrection, ExtractionResult } from './extractor.js';
export { classifyCorrection, mergeCorrections, detectFlipFlop } from './classifier.js';
export type { ClassifiedCorrection } from './classifier.js';
export { processTranscript, processEdit, captureCorrection } from './pipeline.js';
export type { PipelineOptions } from './pipeline.js';
