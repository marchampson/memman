import { createHash } from 'node:crypto';

export function contentHash(content: string): string {
  return createHash('sha256').update(content.trim()).digest('hex').slice(0, 16);
}

export function fileHash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}
