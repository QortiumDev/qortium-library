import { describe, it, expect } from 'vitest';
import { toIdentifier, fileExtension } from './identifier';

describe('fileExtension', () => {
  it('extracts and lowercases the extension', () => {
    expect(fileExtension('MyBook.PDF')).toBe('.pdf');
  });

  it('returns empty string when there is no extension', () => {
    expect(fileExtension('README')).toBe('');
  });

  it('handles filenames with dots in the name itself', () => {
    expect(fileExtension('vol.1.epub')).toBe('.epub');
  });
});

describe('toIdentifier', () => {
  it('is deterministic - same filename always produces the same identifier', async () => {
    const a = await toIdentifier('Foundation.epub');
    const b = await toIdentifier('Foundation.epub');
    expect(a).toBe(b);
  });

  it('produces different identifiers for different filenames', async () => {
    const a = await toIdentifier('Foundation.epub');
    const b = await toIdentifier('Foundation 2.epub');
    expect(a).not.toBe(b);
  });

  it('starts with the qlib- discovery prefix', async () => {
    const id = await toIdentifier('Foundation.epub');
    expect(id.startsWith('qlib-')).toBe(true);
  });

  it('preserves the original file extension', async () => {
    const id = await toIdentifier('Foundation.epub');
    expect(id.endsWith('.epub')).toBe(true);
  });

  it('stays well under the 64-byte identifier cap for a realistic long filename', async () => {
    const id = await toIdentifier('A Very Long Book Title That Goes On.epub');
    expect(new TextEncoder().encode(id).length).toBeLessThanOrEqual(64);
  });

  it('stays within the 64-byte identifier cap even with an unusually long extension', async () => {
    const longExtension = '.' + 'x'.repeat(40);
    const id = await toIdentifier(`Foundation${longExtension}`);
    expect(new TextEncoder().encode(id).length).toBeLessThanOrEqual(64);
  });

  it('is case-insensitive to filename casing', async () => {
    const a = await toIdentifier('Foundation.epub');
    const b = await toIdentifier('FOUNDATION.EPUB');
    expect(a).toBe(b);
  });
});
