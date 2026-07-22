# Book Collections Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the duplicate-on-republish bug, stop titles from silently truncating, and let a publisher attach genres (up to 4) and series membership (name + position) to a book when publishing.

**Architecture:** A handful of small, pure TS modules under `src/lib/` handle the byte-budget math, the deterministic identifier hash, the fixed genre list, and encoding/decoding a machine-managed `::qlib::{...}` JSON block appended to the QDN `description` field. `PublishPage.tsx` is rewired to use them and gains genre/series form controls. `types/index.ts`'s `getResourceTitle` is updated to prefer the marker's full title, so truncation is fixed everywhere a book is displayed, not just on the publish form.

**Tech Stack:** React 19 + TypeScript + MUI 7 (existing), Vitest (new - this plan adds the project's first test runner).

This is plan 1 of 3 covering `docs/superpowers/specs/2026-07-22-book-collections-design.md`. Plan 2 (Browse: genre filter, series badges/pages, prefix search) and Plan 3 (reader playlists) build on this one and will be written separately.

---

## File Structure

**New files:**
- `vitest.config.ts` - test runner config (node environment, no DOM needed for these pure modules)
- `src/lib/bytes.ts` - UTF-8 byte-length/truncation helpers, used by every byte-budget check in this plan
- `src/lib/bytes.test.ts`
- `src/lib/identifier.ts` - deterministic `qlib-<hash><ext>` identifier generation (fixes the duplicate bug)
- `src/lib/identifier.test.ts`
- `src/lib/genres.ts` - the fixed 26-entry genre list
- `src/lib/genres.test.ts`
- `src/lib/tags.ts` - slugify + series-slug + tag-building for the `series:`/`genre:` tags
- `src/lib/tags.test.ts`
- `src/lib/qlibMarker.ts` - encode/decode the `::qlib::{...}` block in `description`
- `src/lib/qlibMarker.test.ts`
- `src/types/index.test.ts` - covers the `getResourceTitle` change below

**Modified files:**
- `package.json` - add `vitest` devDependency and a `test` script
- `src/types/index.ts` - `getResourceTitle` prefers the marker's full title when present
- `src/pages/PublishPage.tsx` - replace the old slug-based identifier/title truncation logic, add genre multi-select + series fields, wire validation

---

## Task 1: Add the Vitest test runner

The project currently has zero test infrastructure. This plan is pure-logic-heavy (hashing, byte-budget math, JSON encode/decode) and none of it touches the DOM, so a plain Vitest setup with the default `node` environment is enough - no jsdom or React Testing Library needed for this plan.

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Install vitest**

Run: `npm install -D vitest`
Expected: package.json's `devDependencies` gains a `vitest` entry; `node_modules/.bin/vitest` exists.

- [ ] **Step 2: Add the test script**

In `package.json`, add a `test` entry to `scripts` (alongside the existing `dev`/`build`/`preview`):

```json
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
```

- [ ] **Step 3: Create the Vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
  },
});
```

- [ ] **Step 4: Verify the runner works with no tests yet**

Run: `npx vitest run`
Expected: `No test files found` (or similar) - exits without error. This confirms the runner is wired up before any real tests exist.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "Add vitest test runner"
```

---

## Task 2: `src/lib/bytes.ts` - UTF-8 byte-budget helpers

Every length check in this plan (title's 80-byte cap, description's 240-byte cap, tags' 20-byte cap) has to count UTF-8 *bytes*, not JS string length - a title with accented characters or emoji can hit the byte cap well before it hits a character-count cap. This module is the one place that logic lives.

**Files:**
- Create: `src/lib/bytes.ts`
- Test: `src/lib/bytes.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/bytes.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { utf8Length, truncateToUtf8Bytes, toSafeTitle } from './bytes';

describe('utf8Length', () => {
  it('counts plain ASCII as 1 byte per char', () => {
    expect(utf8Length('hello')).toBe(5);
  });

  it('counts multi-byte characters correctly', () => {
    // é is 2 bytes in UTF-8
    expect(utf8Length('café')).toBe(5);
  });
});

describe('truncateToUtf8Bytes', () => {
  it('returns the string unchanged when under budget', () => {
    expect(truncateToUtf8Bytes('hello', 10)).toBe('hello');
  });

  it('truncates ASCII to the exact byte budget', () => {
    expect(truncateToUtf8Bytes('hello world', 5)).toBe('hello');
  });

  it('never splits a multi-byte character in half', () => {
    // 'café' is 5 bytes (c-a-f-é where é=2 bytes); budget of 4 must drop
    // the whole é, not emit a broken half-character.
    const result = truncateToUtf8Bytes('café', 4);
    expect(result).toBe('caf');
    expect(utf8Length(result)).toBeLessThanOrEqual(4);
  });

  it('returns empty string for a zero or negative budget', () => {
    expect(truncateToUtf8Bytes('hello', 0)).toBe('');
    expect(truncateToUtf8Bytes('hello', -5)).toBe('');
  });
});

describe('toSafeTitle', () => {
  it('returns short titles unchanged', () => {
    expect(toSafeTitle('Foundation')).toBe('Foundation');
  });

  it('truncates titles over 80 bytes and appends an ellipsis', () => {
    const longTitle = 'A'.repeat(100);
    const result = toSafeTitle(longTitle);
    expect(utf8Length(result)).toBeLessThanOrEqual(80);
    expect(result.endsWith('…')).toBe(true);
  });

  it('keeps the result at or under the 80-byte cap even with multi-byte chars', () => {
    const longTitle = 'é'.repeat(60); // 120 bytes raw
    const result = toSafeTitle(longTitle);
    expect(utf8Length(result)).toBeLessThanOrEqual(80);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/bytes.test.ts`
Expected: FAIL - `Cannot find module './bytes'` (the module doesn't exist yet).

- [ ] **Step 3: Implement `bytes.ts`**

Create `src/lib/bytes.ts`:

```ts
export function utf8Length(s: string): number {
  return new TextEncoder().encode(s).length;
}

// Truncates by dropping whole characters from the end until the UTF-8 byte
// length fits the budget, so a multi-byte character is never split in half.
export function truncateToUtf8Bytes(s: string, maxBytes: number): string {
  if (maxBytes <= 0) return '';
  let out = s;
  while (utf8Length(out) > maxBytes) out = out.slice(0, -1);
  return out;
}

// Qortium Core silently trims the `title` metadata field past this many
// UTF-8 bytes (ArbitraryDataTransactionMetadata.MAX_TITLE_LENGTH). We trim
// ourselves first so the app controls where the cut happens and can signal
// it clearly, instead of Core doing it invisibly.
const TITLE_MAX_BYTES = 80;
const ELLIPSIS = '…';

export function toSafeTitle(title: string): string {
  if (utf8Length(title) <= TITLE_MAX_BYTES) return title;
  const budget = TITLE_MAX_BYTES - utf8Length(ELLIPSIS);
  return truncateToUtf8Bytes(title, budget) + ELLIPSIS;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/bytes.test.ts`
Expected: PASS - all tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/bytes.ts src/lib/bytes.test.ts
git commit -m "Add UTF-8 byte-budget helpers"
```

---

## Task 3: `src/lib/identifier.ts` - deterministic identifier (fixes the duplicate bug)

This is the actual fix for "republishing the same book creates a duplicate instead of overwriting." The current code in `PublishPage.tsx` appends a random UUID slice to every identifier; this module replaces that with a hash of the filename, so the same file always produces the same identifier.

**Files:**
- Create: `src/lib/identifier.ts`
- Test: `src/lib/identifier.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/identifier.test.ts`:

```ts
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

  it('stays well under the 64-byte identifier cap', async () => {
    const id = await toIdentifier('A Very Long Book Title That Goes On.epub');
    expect(new TextEncoder().encode(id).length).toBeLessThanOrEqual(64);
  });

  it('is case-insensitive to filename casing', async () => {
    const a = await toIdentifier('Foundation.epub');
    const b = await toIdentifier('FOUNDATION.EPUB');
    expect(a).toBe(b);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/identifier.test.ts`
Expected: FAIL - `Cannot find module './identifier'`.

- [ ] **Step 3: Implement `identifier.ts`**

Create `src/lib/identifier.ts`:

```ts
// QDN only overwrites a resource when (service, name, identifier) matches
// exactly. A deterministic identifier - same filename in, same identifier
// out - means republishing the same book overwrites it instead of creating
// a duplicate. The "qlib-" prefix doubles as a discovery marker: Browse can
// find every book this app published with a single identifier-prefix search
// instead of scanning the whole DOCUMENT service or relying on a tag.
const QLIB_PREFIX = 'qlib-';
const HASH_HEX_CHARS = 12; // 48 bits - collisions only matter within one publisher's own catalog

export function fileExtension(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot > 0 ? filename.slice(dot).toLowerCase() : '';
}

export async function hashFilename(filename: string): Promise<string> {
  const bytes = new TextEncoder().encode(filename.toLowerCase());
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hex = Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return hex.slice(0, HASH_HEX_CHARS);
}

export async function toIdentifier(filename: string): Promise<string> {
  const hash = await hashFilename(filename);
  return `${QLIB_PREFIX}${hash}${fileExtension(filename)}`;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/identifier.test.ts`
Expected: PASS - all tests green. (Requires Node 20+ for global `crypto.subtle`, matching Vite 8's own Node requirement.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/identifier.ts src/lib/identifier.test.ts
git commit -m "Add deterministic identifier generation"
```

---

## Task 4: `src/lib/genres.ts` - the fixed genre list

**Files:**
- Create: `src/lib/genres.ts`
- Test: `src/lib/genres.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/genres.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/genres.test.ts`
Expected: FAIL - `Cannot find module './genres'`.

- [ ] **Step 3: Implement `genres.ts`**

Create `src/lib/genres.ts`:

```ts
export interface Genre {
  slug:  string;
  label: string;
}

// Fixed, flat, in-app list. Every slug was checked to fit the 20-byte tag
// budget once prefixed with "genre:" (6 bytes) - a few longer display names
// get a shortened slug (e.g. Mystery/Thriller -> "mystery", not
// "mystery-thriller", which would be 16 bytes and too long).
export const GENRES: Genre[] = [
  { slug: 'sci-fi',        label: 'Sci-Fi' },
  { slug: 'fantasy',       label: 'Fantasy' },
  { slug: 'mystery',       label: 'Mystery/Thriller' },
  { slug: 'horror',        label: 'Horror' },
  { slug: 'romance',       label: 'Romance' },
  { slug: 'adventure',     label: 'Adventure' },
  { slug: 'hist-fiction',  label: 'Historical Fiction' },
  { slug: 'history',       label: 'History/Humanities' },
  { slug: 'memoir-bio',    label: 'Memoir/Biography' },
  { slug: 'true-crime',    label: 'True Crime' },
  { slug: 'self-help',     label: 'Self-Help' },
  { slug: 'how-to-diy',    label: 'How-To/DIY' },
  { slug: 'blueprint',     label: 'Blueprint/Diagram' },
  { slug: 'business',      label: 'Business' },
  { slug: 'philosophy',    label: 'Philosophy' },
  { slug: 'science',       label: 'Science' },
  { slug: 'occult',        label: 'Occult' },
  { slug: 'recipe',        label: 'Recipe' },
  { slug: 'poetry',        label: 'Poetry' },
  { slug: 'graphic-novel', label: 'Comics/Graphic Novel' },
  { slug: 'childrens',     label: "Children's" },
  { slug: 'young-adult',   label: 'Young Adult' },
  { slug: 'humor',         label: 'Humor' },
  { slug: 'reference',     label: 'Reference' },
  { slug: 'spirituality',  label: 'Religion/Spirituality' },
  { slug: 'travel',        label: 'Travel' },
];

export const MAX_GENRES_PER_BOOK = 4;

export function genreLabel(slug: string): string {
  return GENRES.find(g => g.slug === slug)?.label ?? slug;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/genres.test.ts`
Expected: PASS - all tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/genres.ts src/lib/genres.test.ts
git commit -m "Add fixed genre list"
```

---

## Task 5: `src/lib/tags.ts` - series slug + tag building

**Files:**
- Create: `src/lib/tags.ts`
- Test: `src/lib/tags.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/tags.test.ts`:

```ts
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
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/tags.test.ts`
Expected: FAIL - `Cannot find module './tags'`.

- [ ] **Step 3: Implement `tags.ts`**

Create `src/lib/tags.ts`:

```ts
import { utf8Length, truncateToUtf8Bytes } from './bytes';
import { MAX_GENRES_PER_BOOK } from './genres';

const MAX_TAG_BYTES = 20;
const COMBINING_MARKS = /\p{M}/gu;

export function slugify(text: string): string {
  return text
    .normalize('NFKD').replace(COMBINING_MARKS, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
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
  const fitted = truncateToUtf8Bytes(raw, budget);
  return fitted || null;
}

export function buildTags(genres: string[], seriesSlugValue: string | null): string[] {
  const tags: string[] = [];
  if (seriesSlugValue) tags.push(`series:${seriesSlugValue}`);
  for (const slug of genres.slice(0, MAX_GENRES_PER_BOOK)) tags.push(`genre:${slug}`);
  return tags;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/tags.test.ts`
Expected: PASS - all tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/tags.ts src/lib/tags.test.ts
git commit -m "Add series slug and tag-building helpers"
```

---

## Task 6: `src/lib/qlibMarker.ts` - the self-describing metadata block

This is the core of the data model: every book carries its own title/series/genre data inside `description`, so nothing about how a book displays depends on a second resource fetch succeeding.

**Files:**
- Create: `src/lib/qlibMarker.ts`
- Test: `src/lib/qlibMarker.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/qlibMarker.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  encodeDescription, decodeDescription, freeTextBudget,
  MarkerTooLargeError, MAX_DESCRIPTION_BYTES, MARKER_PREFIX,
  type QlibMarker,
} from './qlibMarker';

describe('encodeDescription / decodeDescription round-trip', () => {
  it('round-trips free text and a full marker', () => {
    const marker: QlibMarker = {
      title: 'Foundation', series: 'foundation', seriesTitle: 'Foundation',
      pos: 2, of: 7, genres: ['sci-fi', 'adventure'],
    };
    const encoded = encodeDescription('A classic of the genre.', marker);
    const { freeText, marker: decoded } = decodeDescription(encoded);
    expect(freeText).toBe('A classic of the genre.');
    expect(decoded).toEqual(marker);
  });

  it('round-trips with no free text at all', () => {
    const marker: QlibMarker = { title: 'Foundation' };
    const encoded = encodeDescription('', marker);
    const { freeText, marker: decoded } = decodeDescription(encoded);
    expect(freeText).toBe('');
    expect(decoded).toEqual(marker);
  });

  it('omits optional marker fields when not set', () => {
    const marker: QlibMarker = { title: 'Foundation' };
    const encoded = encodeDescription('desc', marker);
    expect(encoded).not.toContain('"series"');
    expect(encoded).not.toContain('"genres"');
  });
});

describe('decodeDescription graceful fallback', () => {
  it('returns the raw text with a null marker when there is no marker block', () => {
    const result = decodeDescription('Just a plain description, no marker.');
    expect(result.freeText).toBe('Just a plain description, no marker.');
    expect(result.marker).toBeNull();
  });

  it('returns a null marker (not a throw) for malformed JSON after the prefix', () => {
    const result = decodeDescription(`Some text\n\n${MARKER_PREFIX}{not valid json`);
    expect(result.marker).toBeNull();
  });

  it('returns a null marker when the parsed JSON has no title field', () => {
    const result = decodeDescription(`${MARKER_PREFIX}{"series":"foundation"}`);
    expect(result.marker).toBeNull();
  });

  it('handles undefined input', () => {
    const result = decodeDescription(undefined);
    expect(result.freeText).toBe('');
    expect(result.marker).toBeNull();
  });
});

describe('freeTextBudget', () => {
  it('leaves most of the 240-byte budget free for a title-only marker', () => {
    const budget = freeTextBudget({ title: 'Foundation' });
    expect(budget).toBeGreaterThan(150);
    expect(budget).toBeLessThan(MAX_DESCRIPTION_BYTES);
  });

  it('shrinks as more marker fields are added', () => {
    const small = freeTextBudget({ title: 'Foundation' });
    const large = freeTextBudget({
      title: 'Foundation', series: 'foundation', seriesTitle: 'Foundation',
      pos: 2, of: 7, genres: ['sci-fi', 'adventure', 'dystopian', 'space-opera'],
    });
    expect(large).toBeLessThan(small);
  });
});

describe('encodeDescription overflow', () => {
  it('truncates free text that would overflow the description budget', () => {
    const longText = 'x'.repeat(300);
    const encoded = encodeDescription(longText, { title: 'Foundation' });
    expect(new TextEncoder().encode(encoded).length).toBeLessThanOrEqual(MAX_DESCRIPTION_BYTES);
    // The marker itself must never be truncated - it should still parse.
    const { marker } = decodeDescription(encoded);
    expect(marker?.title).toBe('Foundation');
  });

  it('throws MarkerTooLargeError when the marker alone cannot fit the budget', () => {
    const marker: QlibMarker = {
      title: 'x'.repeat(300), // absurdly long, on its own exceeds 240 bytes
    };
    expect(() => encodeDescription('', marker)).toThrow(MarkerTooLargeError);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/qlibMarker.test.ts`
Expected: FAIL - `Cannot find module './qlibMarker'`.

- [ ] **Step 3: Implement `qlibMarker.ts`**

Create `src/lib/qlibMarker.ts`:

```ts
import { utf8Length, truncateToUtf8Bytes } from './bytes';

// Sentinel that separates the author's free-text description from the
// machine-managed JSON block. Never shown to or editable by the publisher
// directly - PublishPage only ever lets them edit the free-text portion and
// pick genre/series through structured controls; this module owns the
// serialization.
export const MARKER_PREFIX = '::qlib::';

// Matches ArbitraryDataTransactionMetadata.MAX_DESCRIPTION_LENGTH in Qortium
// Core - description is silently trimmed past this many UTF-8 bytes.
export const MAX_DESCRIPTION_BYTES = 240;

const SEPARATOR = '\n\n';

export interface QlibMarker {
  title:        string;
  series?:      string;
  seriesTitle?: string;
  pos?:         number;
  of?:          number;
  genres?:      string[];
}

export class MarkerTooLargeError extends Error {}

function markerJson(marker: QlibMarker): string {
  return MARKER_PREFIX + JSON.stringify(marker);
}

// How many bytes are left for the author's free text once the marker (which
// varies in size depending on how much series/genre data is attached) is
// accounted for. Exported so the publish form can show a live byte counter
// that reflects the *current* marker, not a flat assumption.
export function freeTextBudget(marker: QlibMarker): number {
  return MAX_DESCRIPTION_BYTES - utf8Length(markerJson(marker)) - utf8Length(SEPARATOR);
}

export function encodeDescription(freeText: string, marker: QlibMarker): string {
  const budget = freeTextBudget(marker);
  if (budget < 0) {
    throw new MarkerTooLargeError(
      `Title/series/genre info doesn't fit in the ${MAX_DESCRIPTION_BYTES}-byte description budget - ` +
      `try a shorter title or series name.`
    );
  }
  const trimmed = truncateToUtf8Bytes(freeText, budget);
  const json = markerJson(marker);
  return trimmed ? `${trimmed}${SEPARATOR}${json}` : json;
}

function isQlibMarker(value: unknown): value is QlibMarker {
  return typeof value === 'object' && value !== null
    && typeof (value as Record<string, unknown>).title === 'string';
}

export function decodeDescription(raw: string | undefined): { freeText: string; marker: QlibMarker | null } {
  if (!raw) return { freeText: '', marker: null };

  const idx = raw.indexOf(MARKER_PREFIX);
  if (idx === -1) return { freeText: raw, marker: null };

  const freeText = raw.slice(0, idx).trimEnd();
  const jsonPart = raw.slice(idx + MARKER_PREFIX.length);

  try {
    const parsed: unknown = JSON.parse(jsonPart);
    if (!isQlibMarker(parsed)) return { freeText: raw, marker: null };
    return { freeText, marker: parsed };
  } catch {
    return { freeText: raw, marker: null };
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/qlibMarker.test.ts`
Expected: PASS - all tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/qlibMarker.ts src/lib/qlibMarker.test.ts
git commit -m "Add self-describing book metadata encode/decode"
```

---

## Task 7: Fix title truncation everywhere books are displayed

`getResourceTitle` in `src/types/index.ts` is the single function every book-displaying component calls (`BookCard`, etc.). Making it prefer the marker's full title fixes truncated titles across the whole app immediately, even before Plan 2 adds explicit series/genre badges.

**Files:**
- Modify: `src/types/index.ts:80-82`
- Test: `src/types/index.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/types/index.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { getResourceTitle, type QdnResource } from './index';
import { encodeDescription } from '../lib/qlibMarker';

function baseResource(overrides: Partial<QdnResource> = {}): QdnResource {
  return { service: 'DOCUMENT', name: 'author', identifier: 'qlib-abc123.pdf', ...overrides };
}

describe('getResourceTitle', () => {
  it('prefers the marker title when a description marker is present', () => {
    const description = encodeDescription('blurb', {
      title: 'The Full Untruncated Title That Would Otherwise Get Cut',
    });
    const resource = baseResource({ title: 'Short label', description });
    expect(getResourceTitle(resource)).toBe('The Full Untruncated Title That Would Otherwise Get Cut');
  });

  it('reads the marker from metadata.description when top-level description is absent', () => {
    const description = encodeDescription('blurb', { title: 'Marker Title' });
    const resource = baseResource({ metadata: { description } });
    expect(getResourceTitle(resource)).toBe('Marker Title');
  });

  it('falls back to the plain title field when there is no marker', () => {
    const resource = baseResource({ title: 'Plain Title', description: 'just text, no marker' });
    expect(getResourceTitle(resource)).toBe('Plain Title');
  });

  it('falls back to the identifier when there is no title or marker at all', () => {
    const resource = baseResource({ identifier: 'qlib-xyz.pdf' });
    expect(getResourceTitle(resource)).toBe('qlib-xyz.pdf');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/types/index.test.ts`
Expected: FAIL - the marker-title tests fail because `getResourceTitle` doesn't know about the marker yet (it returns `'Short label'` / `undefined` instead of the marker's title).

- [ ] **Step 3: Update `getResourceTitle`**

In `src/types/index.ts`, add the import at the top of the file:

```ts
import { decodeDescription } from '../lib/qlibMarker';
```

Replace lines 80-82:

```ts
export function getResourceTitle(resource: QdnResource): string {
  return resource.metadata?.title || resource.title || resource.identifier;
}
```

with:

```ts
export function getResourceTitle(resource: QdnResource): string {
  const { marker } = decodeDescription(resource.metadata?.description || resource.description);
  if (marker?.title) return marker.title;
  return resource.metadata?.title || resource.title || resource.identifier;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/types/index.test.ts`
Expected: PASS - all tests green.

- [ ] **Step 5: Run the full test suite to make sure nothing else broke**

Run: `npx vitest run`
Expected: PASS - every test file (bytes, identifier, genres, tags, qlibMarker, types/index) passes.

- [ ] **Step 6: Commit**

```bash
git add src/types/index.ts src/types/index.test.ts
git commit -m "Prefer full marker title over truncated title field"
```

---

## Task 8: Rewire PublishPage's identifier, title, and description logic

Replaces the old random-suffix identifier and raw title/description handling with the new deterministic identifier and marker-based description. No UI changes yet - that's Task 9.

**Files:**
- Modify: `src/pages/PublishPage.tsx`

- [ ] **Step 1: Replace the old identifier/byte-budget code with imports from the new lib modules**

In `src/pages/PublishPage.tsx`, remove the old local implementation (currently lines 44-73 - the `MAX_IDENTIFIER_BYTES` constant, `COMBINING_MARKS` regex, `utf8Length`, and `toIdentifier` functions):

```ts
// QDN identifiers are capped at 64 bytes (UTF-8) at the transaction level, but
// that limit is only enforced when the signed transaction is later decoded
// (e.g. on broadcast) - not when it's first built. Publishing raw filenames
// as identifiers therefore appears to succeed and only fails afterwards with
// an opaque "could not transform JSON into transaction" error. The identifier
// only needs to be a unique key, not the display name (that's `title`), so
// slugify and truncate it and rely on a short random suffix for uniqueness.
const MAX_IDENTIFIER_BYTES = 64;
const COMBINING_MARKS = /[\u0300-\u036f]/g;

function utf8Length(s: string): number {
  return new TextEncoder().encode(s).length;
}

function toIdentifier(filename: string, uid: string): string {
  const dot = filename.lastIndexOf('.');
  const ext = dot > 0 ? filename.slice(dot) : '';
  const base = (dot > 0 ? filename.slice(0, dot) : filename)
    .normalize('NFKD').replace(COMBINING_MARKS, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'book';

  const suffix = `-${uid}`;
  const budget = MAX_IDENTIFIER_BYTES - utf8Length(ext) - utf8Length(suffix);
  let truncated = base;
  while (utf8Length(truncated) > budget) truncated = truncated.slice(0, -1);

  return `${truncated}${suffix}${ext}`;
}
```

Add these imports near the top of the file, alongside the existing `import { fileToBase64, publishMultipleResources, ensureAccountUnlocked } from '../api/qortal';` line:

```ts
import { toIdentifier } from '../lib/identifier';
import { toSafeTitle, utf8Length } from '../lib/bytes';
import { encodeDescription, freeTextBudget, MarkerTooLargeError, type QlibMarker } from '../lib/qlibMarker';
import { GENRES, MAX_GENRES_PER_BOOK } from '../lib/genres';
import { seriesSlug, buildTags } from '../lib/tags';
```

- [ ] **Step 2: Extend `PendingBook` with genre/series fields**

Replace the `PendingBook` interface:

```ts
interface PendingBook {
  id:          string;
  file:        File;
  fileType:    FileType;
  title:       string;
  description: string;
  status:      UploadStatus;
  errorMsg?:   string;
}
```

with:

```ts
interface PendingBook {
  id:          string;
  file:        File;
  fileType:    FileType;
  title:       string;
  description: string;
  genres:      string[]; // genre slugs, max MAX_GENRES_PER_BOOK
  seriesName:  string;   // '' means "not part of a series"
  seriesPos:   string;   // numeric text input state
  seriesOf:    string;   // optional numeric text input state
  status:      UploadStatus;
  errorMsg?:   string;
}
```

- [ ] **Step 3: Initialize the new fields when a file is added**

In `addFiles`, the object literal that builds each new `PendingBook` currently ends with `status: 'pending' as UploadStatus,`. Add the new fields to that same literal:

```ts
      ...valid.map(f => ({
        id:          crypto.randomUUID(),
        file:        f,
        fileType:    getFileType(f.name),
        title:       titleFromFilename(f.name),
        description: '',
        genres:      [] as string[],
        seriesName:  '',
        seriesPos:   '',
        seriesOf:    '',
        status:      'pending' as UploadStatus,
      })),
```

- [ ] **Step 4: Add a validation function**

Add this function above `handlePublishAll`:

```ts
function validateBook(b: PendingBook): string | null {
  if (!b.title.trim()) return 'Title is required';
  if (b.genres.length > MAX_GENRES_PER_BOOK) return `Choose at most ${MAX_GENRES_PER_BOOK} genres`;
  if (b.seriesName.trim()) {
    if (!seriesSlug(b.seriesName)) {
      return 'Series name is too unusual to tag - try something with more letters or numbers';
    }
    const pos = Number(b.seriesPos);
    if (!Number.isInteger(pos) || pos <= 0) {
      return 'Series position must be a whole number greater than 0';
    }
  }
  return null;
}
```

- [ ] **Step 5: Rewrite `handlePublishAll` to validate first, then use the new identifier/description/tags**

Replace the whole `handlePublishAll` function:

```ts
  async function handlePublishAll() {
    if (!account?.name || books.length === 0) return;
    setPublishing(true);

    const pending = books.filter(b => b.status === 'pending');
    setBooks(prev => prev.map(b => b.status === 'pending' ? { ...b, status: 'publishing' } : b));

    try {
      if (!await ensureAccountUnlocked()) return;
      const resources = await Promise.all(
        pending.map(async b => ({
          service:     'DOCUMENT',
          name:        account.name as string,
          identifier:  toIdentifier(b.file.name, b.id.slice(0, 8)),
          data64:      await fileToBase64(b.file),
          filename:    b.file.name,
          title:       b.title.trim() || undefined,
          description: b.description.trim() || undefined,
          tags:        ['qlib-book'],
        }))
      );

      await publishMultipleResources(resources);

      setBooks(prev => prev.map(b =>
        b.status === 'publishing' ? { ...b, status: 'done' } : b
      ));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Publish failed';
      setBooks(prev => prev.map(b =>
        b.status === 'publishing' ? { ...b, status: 'error', errorMsg: msg } : b
      ));
    } finally {
      setPublishing(false);
    }
  }
```

with:

```ts
  async function handlePublishAll() {
    if (!account?.name || books.length === 0) return;

    const pending = books.filter(b => b.status === 'pending');
    const errors = new Map(pending.map(b => [b.id, validateBook(b)]));
    if ([...errors.values()].some(err => err !== null)) {
      setBooks(prev => prev.map(b => {
        const err = errors.get(b.id);
        return err ? { ...b, status: 'error', errorMsg: err } : b;
      }));
      return;
    }

    setPublishing(true);
    setBooks(prev => prev.map(b => b.status === 'pending' ? { ...b, status: 'publishing' } : b));

    try {
      if (!await ensureAccountUnlocked()) return;
      const resources = await Promise.all(
        pending.map(async b => {
          const slug = b.seriesName.trim() ? seriesSlug(b.seriesName) : null;
          const marker: QlibMarker = {
            title: b.title.trim(),
            ...(b.genres.length ? { genres: b.genres } : {}),
            ...(slug ? {
              series:      slug,
              seriesTitle: b.seriesName.trim(),
              pos:         Number(b.seriesPos),
              ...(b.seriesOf.trim() ? { of: Number(b.seriesOf) } : {}),
            } : {}),
          };

          return {
            service:     'DOCUMENT',
            name:        account.name as string,
            identifier:  await toIdentifier(b.file.name),
            data64:      await fileToBase64(b.file),
            filename:    b.file.name,
            title:       toSafeTitle(b.title.trim()),
            description: encodeDescription(b.description.trim(), marker),
            tags:        buildTags(b.genres, slug),
          };
        })
      );

      await publishMultipleResources(resources);

      setBooks(prev => prev.map(b =>
        b.status === 'publishing' ? { ...b, status: 'done' } : b
      ));
    } catch (err) {
      const msg = err instanceof MarkerTooLargeError
        ? err.message
        : err instanceof Error ? err.message : 'Publish failed';
      setBooks(prev => prev.map(b =>
        b.status === 'publishing' ? { ...b, status: 'error', errorMsg: msg } : b
      ));
    } finally {
      setPublishing(false);
    }
  }
```

- [ ] **Step 6: Verify the project still type-checks**

Run: `npx tsc -b --noEmit`
Expected: no errors. (`GENRES` and `freeTextBudget` are imported but not yet used - that's expected, Task 9 uses them. If your TS config errors on unused imports, ignore for now; Task 9 resolves it within the same file.)

- [ ] **Step 7: Commit**

```bash
git add src/pages/PublishPage.tsx
git commit -m "Use deterministic identifier and marker-based description in publish flow"
```

---

## Task 9: Add genre and series controls to the publish form

**Files:**
- Modify: `src/pages/PublishPage.tsx`

- [ ] **Step 1: Add the MUI Autocomplete import**

Add to the top of `src/pages/PublishPage.tsx`, alongside the existing MUI imports:

```ts
import Autocomplete from '@mui/material/Autocomplete';
```

- [ ] **Step 2: Add genre and series controls after the Description field**

Find the "Editable metadata (only when pending)" block - it currently ends after the Description `TextField`:

```tsx
                  <TextField
                    size="small"
                    fullWidth
                    label="Description (optional)"
                    value={book.description}
                    onChange={e => updateBook(book.id, { description: e.target.value })}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        fontSize: '0.8rem',
                        '& fieldset': { borderColor: c.borderLight },
                        '&:hover fieldset': { borderColor: c.accent },
                        '&.Mui-focused fieldset': { borderColor: c.accent },
                      },
                      '& .MuiInputLabel-root': { fontSize: '0.78rem' },
                    }}
                  />
                </Box>
              )}
```

Replace the Description `TextField` and the closing tags with the Description field (now with a byte-budget helper text), a genre picker, and series fields:

```tsx
                  <TextField
                    size="small"
                    fullWidth
                    multiline
                    label="Description (optional)"
                    value={book.description}
                    onChange={e => updateBook(book.id, { description: e.target.value })}
                    helperText={(() => {
                      const slug = book.seriesName.trim() ? seriesSlug(book.seriesName) : null;
                      const marker: QlibMarker = {
                        title: book.title.trim() || 'x',
                        ...(book.genres.length ? { genres: book.genres } : {}),
                        ...(slug ? { series: slug, seriesTitle: book.seriesName.trim(), pos: 1 } : {}),
                      };
                      const budget = freeTextBudget(marker);
                      return `${utf8Length(book.description)} / ${budget} bytes`;
                    })()}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        fontSize: '0.8rem',
                        '& fieldset': { borderColor: c.borderLight },
                        '&:hover fieldset': { borderColor: c.accent },
                        '&.Mui-focused fieldset': { borderColor: c.accent },
                      },
                      '& .MuiInputLabel-root': { fontSize: '0.78rem' },
                    }}
                  />

                  <Autocomplete
                    multiple
                    size="small"
                    options={GENRES}
                    getOptionLabel={g => g.label}
                    isOptionEqualToValue={(a, b) => a.slug === b.slug}
                    value={GENRES.filter(g => book.genres.includes(g.slug))}
                    onChange={(_, selected) => {
                      if (selected.length > MAX_GENRES_PER_BOOK) return;
                      updateBook(book.id, { genres: selected.map(g => g.slug) });
                    }}
                    getOptionDisabled={g =>
                      book.genres.length >= MAX_GENRES_PER_BOOK && !book.genres.includes(g.slug)
                    }
                    renderInput={params => (
                      <TextField
                        {...params}
                        label={`Genres (${book.genres.length}/${MAX_GENRES_PER_BOOK})`}
                        sx={{
                          '& .MuiOutlinedInput-root': { fontSize: '0.8rem' },
                          '& .MuiInputLabel-root': { fontSize: '0.78rem' },
                        }}
                      />
                    )}
                  />

                  <TextField
                    size="small"
                    fullWidth
                    label="Part of a series? (optional)"
                    value={book.seriesName}
                    onChange={e => updateBook(book.id, { seriesName: e.target.value })}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        fontSize: '0.8rem',
                        '& fieldset': { borderColor: c.borderLight },
                        '&:hover fieldset': { borderColor: c.accent },
                        '&.Mui-focused fieldset': { borderColor: c.accent },
                      },
                      '& .MuiInputLabel-root': { fontSize: '0.78rem' },
                    }}
                  />

                  {book.seriesName.trim() && (
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <TextField
                        size="small"
                        type="number"
                        label="Position"
                        value={book.seriesPos}
                        onChange={e => updateBook(book.id, { seriesPos: e.target.value })}
                        sx={{ flex: 1, '& .MuiOutlinedInput-root': { fontSize: '0.8rem' } }}
                      />
                      <TextField
                        size="small"
                        type="number"
                        label="Of (optional)"
                        value={book.seriesOf}
                        onChange={e => updateBook(book.id, { seriesOf: e.target.value })}
                        sx={{ flex: 1, '& .MuiOutlinedInput-root': { fontSize: '0.8rem' } }}
                      />
                    </Box>
                  )}
                </Box>
              )}
```

- [ ] **Step 3: Verify the project type-checks**

Run: `npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/pages/PublishPage.tsx
git commit -m "Add genre and series controls to the publish form"
```

---

## Task 10: Manual verification

There's no component-test infrastructure in this project (no React Testing Library), so the UI wiring from Tasks 8-9 needs a manual pass. This also doubles as a check that the full test suite is still green.

- [ ] **Step 1: Run the full automated test suite**

Run: `npx vitest run`
Expected: PASS - every test file passes (bytes, identifier, genres, tags, qlibMarker, types/index).

- [ ] **Step 2: Start the dev server**

Run: `npm run dev`
Expected: Vite prints a local URL (e.g. `http://localhost:5173`).

- [ ] **Step 3: Manually verify the publish form**

Open the dev server URL and navigate to the Publish page. Since this app expects to run inside the Qortium Home bridge, `qdnRequest` calls will fail outside it (no account, no real publish) - that's expected. Verify the form itself:
- Drop or select a file: title auto-fills from the filename, genre picker and series fields appear.
- Select 4 genres: a 5th option becomes visually disabled in the dropdown.
- Type a series name: Position and "Of" fields appear.
- Type a long description: the byte counter helper text below the Description field decreases as you type and reflects genre/series selections.
- Leave Title empty and click Publish (if reachable without an account, otherwise inspect via React DevTools that `validateBook` returns `'Title is required'`): confirm the row shows the error state instead of silently proceeding.

- [ ] **Step 4: Stop the dev server**

Press `Ctrl+C` in the terminal running `npm run dev`.

- [ ] **Step 5: Final commit (if any manual fixes were needed)**

If Step 3 surfaced any issues and you made fixes, commit them:

```bash
git add -A
git commit -m "Fix issues found during manual publish-form verification"
```

If no fixes were needed, there's nothing to commit - this plan is complete.

---

## Self-Review Notes

- **Spec coverage:** identifier fix (Task 3, 8) · title truncation fix everywhere displayed (Task 7) · self-describing marker block with graceful fallback (Task 6) · genre taxonomy with byte-budget validation (Task 4) · series metadata + slug validation (Task 5, 8) · publish-form validation table from the spec - empty title, >4 genres, bad series slug, invalid series position, description overflow (Task 8 `validateBook` + `encodeDescription`'s truncation) · genre cap UI graying out at 4 (Task 9). Browse changes (prefix search, genre filter, series badges/pages) and reader playlists are explicitly out of scope for this plan - they're Plans 2 and 3.
- **Type consistency:** `QlibMarker` is defined once in `qlibMarker.ts` (Task 6) and imported everywhere else that needs it (Task 7's test, Task 8's `PublishPage.tsx`) rather than redefined. `MAX_GENRES_PER_BOOK` is defined once in `genres.ts` and imported by both `tags.ts` (Task 5) and `PublishPage.tsx` (Task 8-9).
- **No placeholders:** every step has complete, runnable code - no "add validation here" style steps.
