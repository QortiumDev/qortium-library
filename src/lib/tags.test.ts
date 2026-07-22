import { describe, it, expect } from 'vitest';
import { slugify, seriesSlug, buildTags } from './tags';

describe('slugify', () => {
  it('lowercases and hyphenates spaces', () => {
    expect(slugify('The Foundation Series')).toBe('the-foundation-series');
  });

  it('strips accents', () => {
    expect(slugify('Café Trilogy')).toBe('cafe-trilogy');
  });

  it('strips punctuation', () => {
    expect(slugify("Author's Best Work!")).toBe('authors-best-work');
  });

  it('returns empty string for input with no sluggable characters', () => {
    expect(slugify('!!!')).toBe('');
  });
});

describe('seriesSlug', () => {
  it('produces a slug that fits the 20-byte tag budget with "series:" prefix', () => {
    const slug = seriesSlug('Foundation');
    expect(slug).toBe('foundation');
    const tagBytes = new TextEncoder().encode(`series:${slug}`).length;
    expect(tagBytes).toBeLessThanOrEqual(20);
  });

  it('truncates a long series name to fit the budget', () => {
    const slug = seriesSlug('An Extremely Long Series Name That Will Not Fit');
    expect(slug).not.toBeNull();
    const tagBytes = new TextEncoder().encode(`series:${slug}`).length;
    expect(tagBytes).toBeLessThanOrEqual(20);
  });

  it('does not leave a trailing hyphen when truncation cuts right after one', () => {
    const slug = seriesSlug('An Extremely Long Series Name That Will Not Fit');
    expect(slug).not.toMatch(/-$/);
  });

  it('returns null when the name has no sluggable characters', () => {
    expect(seriesSlug('!!!')).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(seriesSlug('')).toBeNull();
  });
});

describe('buildTags', () => {
  it('builds a genre: tag per genre slug', () => {
    expect(buildTags(['sci-fi', 'adventure'], null)).toEqual([
      'genre:sci-fi',
      'genre:adventure',
    ]);
  });

  it('puts the series: tag first when present', () => {
    expect(buildTags(['sci-fi'], 'foundation')).toEqual([
      'series:foundation',
      'genre:sci-fi',
    ]);
  });

  it('caps genre tags at 4 even if more are passed in', () => {
    const tags = buildTags(['a', 'b', 'c', 'd', 'e'], null);
    expect(tags.length).toBe(4);
  });

  it('returns just the series tag when there are no genres', () => {
    expect(buildTags([], 'foundation')).toEqual(['series:foundation']);
  });

  it('dedupes duplicate genre slugs', () => {
    const tags = buildTags(['sci-fi', 'sci-fi', 'adventure'], null);
    expect(tags).toEqual(['genre:sci-fi', 'genre:adventure']);
  });
});
