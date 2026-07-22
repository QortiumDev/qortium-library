import { utf8Length, truncateToUtf8Bytes } from './bytes';
import { MAX_GENRES_PER_BOOK } from './genres';

const MAX_TAG_BYTES = 20;
const COMBINING_MARKS = /\p{M}/gu;

export function slugify(text: string): string {
  return text
    .normalize('NFKD').replace(COMBINING_MARKS, '')
    .replace(/[^a-zA-Z0-9\s]+/g, '')
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

// Returns null when the series name can't produce a usable tag at all (e.g.
// entirely non-Latin/punctuation input) - callers should block publish and
// show a clear error rather than silently dropping the series tag.
export function seriesSlug(seriesName: string): string | null {
  const raw = slugify(seriesName);
  if (!raw) return null;
  const budget = MAX_TAG_BYTES - utf8Length('series:');
  const fitted = truncateToUtf8Bytes(raw, budget).replace(/-+$/, '');
  return fitted || null;
}

export function buildTags(genres: string[], seriesSlugValue: string | null): string[] {
  const tags: string[] = [];
  if (seriesSlugValue) tags.push(`series:${seriesSlugValue}`);
  for (const slug of [...new Set(genres)].slice(0, MAX_GENRES_PER_BOOK)) tags.push(`genre:${slug}`);
  return tags;
}
