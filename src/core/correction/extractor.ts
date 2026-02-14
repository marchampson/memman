import type { MemoryCategory } from '../types.js';

export interface ExtractedCorrection {
  incorrect: string;
  correct: string;
  category: MemoryCategory;
  paths: string[];
  confidence: number;
}

export interface ExtractionResult {
  corrections: ExtractedCorrection[];
  source: 'llm' | 'pattern';
}

const EXTRACTION_PROMPT = `You are analyzing a coding session transcript to extract corrections made during the session.

A "correction" is when:
1. The user tells the AI it was wrong about something (explicit correction)
2. The user says "actually, use X instead of Y" (preference correction)
3. The AI recognizes its own mistake and fixes it (self-correction)
4. A pattern/convention/command is updated from old to new (implicit correction)

For each correction found, extract:
- incorrect: What was wrong or outdated
- correct: What is right or current
- category: One of: coding_standard, architecture, command, convention, debugging, preference, workflow, dependency, security, testing, correction
- paths: File paths or glob patterns this correction applies to (empty array if global)
- confidence: 0.0-1.0 how confident you are this is a genuine correction

Return ONLY a JSON object with this exact shape:
{
  "corrections": [
    {
      "incorrect": "string",
      "correct": "string",
      "category": "string",
      "paths": ["string"],
      "confidence": 0.0
    }
  ]
}

If no corrections are found, return: { "corrections": [] }

Transcript to analyze:
`;

export async function extractCorrectionsWithLLM(
  transcript: string,
  apiKey: string,
  model = 'claude-haiku-4-5-20251001',
): Promise<ExtractionResult> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey });

  // Truncate transcript to ~50k chars to stay within context limits
  const truncated = transcript.length > 50000
    ? transcript.slice(0, 25000) + '\n...[truncated]...\n' + transcript.slice(-25000)
    : transcript;

  const response = await client.messages.create({
    model,
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: EXTRACTION_PROMPT + truncated,
      },
    ],
  });

  const text = response.content
    .filter(block => block.type === 'text')
    .map(block => (block as { type: 'text'; text: string }).text)
    .join('');

  try {
    // Extract JSON from response (may be wrapped in markdown code blocks)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { corrections: [], source: 'llm' };
    }

    const parsed = JSON.parse(jsonMatch[0]) as { corrections: ExtractedCorrection[] };

    // Validate and normalize
    const corrections = (parsed.corrections || [])
      .filter(c => c.incorrect || c.correct)
      .map(c => ({
        incorrect: String(c.incorrect || ''),
        correct: String(c.correct || ''),
        category: validateCategory(c.category),
        paths: Array.isArray(c.paths) ? c.paths.map(String) : [],
        confidence: Math.max(0, Math.min(1, Number(c.confidence) || 0.5)),
      }));

    return { corrections, source: 'llm' };
  } catch {
    return { corrections: [], source: 'llm' };
  }
}

function validateCategory(cat: string): MemoryCategory {
  const valid: MemoryCategory[] = [
    'coding_standard', 'architecture', 'command', 'convention',
    'debugging', 'preference', 'workflow', 'dependency',
    'security', 'testing', 'correction',
  ];
  return valid.includes(cat as MemoryCategory) ? (cat as MemoryCategory) : 'correction';
}
