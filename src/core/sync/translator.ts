import type { ParsedEntry, ParsedSection, SourceType } from '../types.js';

// Patterns that are tool-specific and should be adapted when syncing
const CLAUDE_SPECIFIC_PATTERNS = [
  /\bClaude(?:\s+Code)?\b/gi,
  /\bCLAUDE\.md\b/g,
  /\b\.claude\/rules\b/g,
  /\bauto memory\b/gi,
  /\bMEMORY\.md\b/g,
];

const AGENTS_SPECIFIC_PATTERNS = [
  /\bAGENTS\.md\b/g,
  /\bCodex\b/g,
  /\bAGENTS\.override\.md\b/g,
];

export function translateEntryToAgents(entry: ParsedEntry): ParsedEntry {
  let content = entry.content;

  // Remove Claude-specific references that don't make sense in AGENTS.md
  for (const pattern of CLAUDE_SPECIFIC_PATTERNS) {
    // Replace "Claude Code" with "the AI assistant" but be conservative
    // Only replace if it's an instruction directed at Claude specifically
    if (pattern.source.includes('Claude')) {
      content = content.replace(/\bClaude Code should\b/gi, 'The AI assistant should');
      content = content.replace(/\bTell Claude\b/gi, 'Instruct the AI');
    }
  }

  return {
    ...entry,
    content,
  };
}

export function translateEntryToClaude(entry: ParsedEntry): ParsedEntry {
  let content = entry.content;

  // Replace generic AI references with Claude-specific ones where appropriate
  content = content.replace(/\bthe AI assistant should\b/gi, 'Claude Code should');
  content = content.replace(/\binstruct the AI\b/gi, 'Tell Claude');

  return {
    ...entry,
    content,
  };
}

export function translateSection(
  section: ParsedSection,
  targetType: SourceType,
): ParsedSection {
  const translateFn = targetType === 'agents_md'
    ? translateEntryToAgents
    : translateEntryToClaude;

  return {
    ...section,
    entries: section.entries.map(translateFn),
    content: section.entries.map(e => translateFn(e).content).join('\n'),
  };
}

export function shouldSync(entry: ParsedEntry): boolean {
  const lower = entry.content.toLowerCase();

  // Skip entries that are purely tool-specific configuration
  if (lower.includes('mcp server') && lower.includes('claude')) return false;
  if (lower.includes('.claude/settings')) return false;
  if (lower.includes('hooks:')) return false;
  if (lower.includes('claude_desktop_config')) return false;

  // Skip very short entries (likely formatting artifacts)
  if (entry.content.trim().length < 10) return false;

  return true;
}

export function categorizeForSync(entry: ParsedEntry): 'universal' | 'claude_only' | 'agents_only' {
  const lower = entry.content.toLowerCase();

  // Claude-only: references to Claude-specific features
  if (lower.includes('.claude/rules')) return 'claude_only';
  if (lower.includes('auto memory')) return 'claude_only';
  if (lower.includes('memory.md')) return 'claude_only';
  if (lower.includes('claude code hooks')) return 'claude_only';

  // Agents-only: references to AGENTS.md-specific features
  if (lower.includes('agents.override')) return 'agents_only';

  // Universal: coding standards, conventions, architecture
  return 'universal';
}
