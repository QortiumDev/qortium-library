import { describe, it, expect } from 'vitest';
import { GENRES, MAX_GENRES_PER_BOOK, genreLabel } from './genres';

describe('GENRES', () => {
  it('has exactly 26 entries', () => {
    expect(GENRES.length).toBe(26);
  });

  it('has no duplicate slugs', () => {
    const slugs = GENRES.map(g => g.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('every slug fits the 20-byte tag budget with the "genre:" prefix', () => {
    for (const g of GENRES) {
      const tagBytes = new TextEncoder().encode(`genre:${g.slug}`).length;
      expect(tagBytes, `genre:${g.slug} (${g.label})`).toBeLessThanOrEqual(20);
    }
  });

  it('every slug is lowercase with no spaces', () => {
    for (const g of GENRES) {
      expect(g.slug).toMatch(/^[a-z0-9-]+$/);
    }
  });
});

describe('genreLabel', () => {
  it('returns the display label for a known slug', () => {
    expect(genreLabel('sci-fi')).toBe('Sci-Fi');
  });

  it('falls back to the raw slug for an unknown slug', () => {
    expect(genreLabel('unknown-slug')).toBe('unknown-slug');
  });
});

describe('MAX_GENRES_PER_BOOK', () => {
  it('is capped at 4', () => {
    expect(MAX_GENRES_PER_BOOK).toBe(4);
  });
});
