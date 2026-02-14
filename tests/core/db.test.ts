import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { MemoryRepository } from '../../src/core/db/repository.js';
import { contentHash } from '../../src/core/hash.js';

const TEST_DIR = join(__dirname, '../.test-tmp');
const DB_PATH = join(TEST_DIR, 'test.db');

describe('MemoryRepository', () => {
  let db: MemoryRepository;

  beforeEach(() => {
    if (!existsSync(TEST_DIR)) {
      mkdirSync(TEST_DIR, { recursive: true });
    }
    // Remove old DB if it exists
    if (existsSync(DB_PATH)) {
      rmSync(DB_PATH);
    }
    db = new MemoryRepository(DB_PATH);
  });

  afterEach(() => {
    db.close();
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  describe('createEntry', () => {
    it('should create a memory entry', () => {
      const entry = db.createEntry({
        content: 'Always use TypeScript strict mode',
        category: 'coding_standard',
        scope: { level: 'project', project: '/test' },
        source: { type: 'claude_md', file_path: '/test/CLAUDE.md' },
        targets: [],
        tags: ['typescript'],
        content_hash: contentHash('Always use TypeScript strict mode'),
      });

      expect(entry.id).toBeDefined();
      expect(entry.content).toBe('Always use TypeScript strict mode');
      expect(entry.category).toBe('coding_standard');
      expect(entry.use_count).toBe(0);
      expect(entry.staleness_score).toBe(0);
    });
  });

  describe('getEntry', () => {
    it('should retrieve an entry by ID', () => {
      const created = db.createEntry({
        content: 'Test entry',
        category: 'testing',
        scope: { level: 'project' },
        source: { type: 'manual', file_path: '' },
        targets: [],
        tags: [],
        content_hash: contentHash('Test entry'),
      });

      const retrieved = db.getEntry(created.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.content).toBe('Test entry');
    });

    it('should return null for non-existent entry', () => {
      expect(db.getEntry('nonexistent')).toBeNull();
    });
  });

  describe('getEntryByHash', () => {
    it('should find entry by content hash', () => {
      const hash = contentHash('Unique content');
      db.createEntry({
        content: 'Unique content',
        category: 'convention',
        scope: { level: 'project' },
        source: { type: 'manual', file_path: '' },
        targets: [],
        tags: [],
        content_hash: hash,
      });

      const found = db.getEntryByHash(hash);
      expect(found).not.toBeNull();
      expect(found!.content).toBe('Unique content');
    });
  });

  describe('getAllEntries', () => {
    it('should return all entries', () => {
      db.createEntry({
        content: 'Entry 1',
        category: 'coding_standard',
        scope: { level: 'project' },
        source: { type: 'manual', file_path: '' },
        targets: [],
        tags: [],
        content_hash: contentHash('Entry 1'),
      });

      db.createEntry({
        content: 'Entry 2',
        category: 'testing',
        scope: { level: 'project' },
        source: { type: 'manual', file_path: '' },
        targets: [],
        tags: [],
        content_hash: contentHash('Entry 2'),
      });

      const all = db.getAllEntries();
      expect(all.length).toBe(2);
    });

    it('should filter by category', () => {
      db.createEntry({
        content: 'Entry 1',
        category: 'coding_standard',
        scope: { level: 'project' },
        source: { type: 'manual', file_path: '' },
        targets: [],
        tags: [],
        content_hash: contentHash('Entry 1'),
      });

      db.createEntry({
        content: 'Entry 2',
        category: 'testing',
        scope: { level: 'project' },
        source: { type: 'manual', file_path: '' },
        targets: [],
        tags: [],
        content_hash: contentHash('Entry 2'),
      });

      const testing = db.getAllEntries({ category: 'testing' });
      expect(testing.length).toBe(1);
      expect(testing[0].content).toBe('Entry 2');
    });
  });

  describe('updateEntry', () => {
    it('should update entry fields', () => {
      const entry = db.createEntry({
        content: 'Original',
        category: 'convention',
        scope: { level: 'project' },
        source: { type: 'manual', file_path: '' },
        targets: [],
        tags: [],
        content_hash: contentHash('Original'),
      });

      db.updateEntry(entry.id, {
        content: 'Updated',
        content_hash: contentHash('Updated'),
      });

      const updated = db.getEntry(entry.id);
      expect(updated!.content).toBe('Updated');
    });
  });

  describe('deleteEntry', () => {
    it('should delete an entry', () => {
      const entry = db.createEntry({
        content: 'To delete',
        category: 'convention',
        scope: { level: 'project' },
        source: { type: 'manual', file_path: '' },
        targets: [],
        tags: [],
        content_hash: contentHash('To delete'),
      });

      db.deleteEntry(entry.id);
      expect(db.getEntry(entry.id)).toBeNull();
    });
  });

  describe('searchEntries', () => {
    it('should find entries by content search', () => {
      db.createEntry({
        content: 'Use TypeScript strict mode',
        category: 'coding_standard',
        scope: { level: 'project' },
        source: { type: 'manual', file_path: '' },
        targets: [],
        tags: [],
        content_hash: contentHash('Use TypeScript strict mode'),
      });

      db.createEntry({
        content: 'Always run tests before pushing',
        category: 'testing',
        scope: { level: 'project' },
        source: { type: 'manual', file_path: '' },
        targets: [],
        tags: [],
        content_hash: contentHash('Always run tests before pushing'),
      });

      const results = db.searchEntries('TypeScript');
      expect(results.length).toBe(1);
      expect(results[0].content).toContain('TypeScript');
    });
  });

  describe('incrementUseCount', () => {
    it('should increment use count and log usage', () => {
      const entry = db.createEntry({
        content: 'Test',
        category: 'convention',
        scope: { level: 'project' },
        source: { type: 'manual', file_path: '' },
        targets: [],
        tags: [],
        content_hash: contentHash('Test'),
      });

      db.incrementUseCount(entry.id, 'test context');
      db.incrementUseCount(entry.id, 'test context 2');

      const updated = db.getEntry(entry.id);
      expect(updated!.use_count).toBe(2);

      const stats = db.getUsageStats(entry.id);
      expect(stats.total).toBe(2);
    });
  });

  describe('corrections', () => {
    it('should create and retrieve corrections', () => {
      const correction = db.createCorrection({
        incorrect: 'npm install',
        correct: 'pnpm install',
        category: 'command',
        confidence: 0.9,
        source: 'manual',
      });

      expect(correction.id).toBeDefined();
      expect(correction.confidence).toBe(0.9);

      const all = db.getCorrections();
      expect(all.length).toBe(1);
      expect(all[0].incorrect).toBe('npm install');
    });

    it('should filter corrections by confidence', () => {
      db.createCorrection({
        incorrect: 'low conf',
        correct: 'fixed',
        category: 'correction',
        confidence: 0.3,
        source: 'hook_pattern',
      });

      db.createCorrection({
        incorrect: 'high conf',
        correct: 'fixed',
        category: 'correction',
        confidence: 0.9,
        source: 'hook_llm',
      });

      const highConf = db.getCorrections({ minConfidence: 0.7 });
      expect(highConf.length).toBe(1);
      expect(highConf[0].incorrect).toBe('high conf');
    });
  });

  describe('getCategoryDistribution', () => {
    it('should return category counts', () => {
      db.createEntry({
        content: 'A',
        category: 'coding_standard',
        scope: { level: 'project' },
        source: { type: 'manual', file_path: '' },
        targets: [],
        tags: [],
        content_hash: contentHash('A'),
      });

      db.createEntry({
        content: 'B',
        category: 'coding_standard',
        scope: { level: 'project' },
        source: { type: 'manual', file_path: '' },
        targets: [],
        tags: [],
        content_hash: contentHash('B'),
      });

      db.createEntry({
        content: 'C',
        category: 'testing',
        scope: { level: 'project' },
        source: { type: 'manual', file_path: '' },
        targets: [],
        tags: [],
        content_hash: contentHash('C'),
      });

      const dist = db.getCategoryDistribution();
      expect(dist.coding_standard).toBe(2);
      expect(dist.testing).toBe(1);
    });
  });
});
