# Book Detail Page

## Problem

A batch of user requests came in after v1.3.0 shipped: real bookmarking/resume, showing book details and genres, browsing by genre, viewing a whole series, flagging and republishing legacy books, real cover art, and deep linking to a book or series. These are six-plus separate sub-projects, not one feature. This doc covers the first and most foundational of them: a page a reader lands on after clicking a book, which several of the other sub-projects will extend or link into rather than duplicate.

Today there is no such page. Clicking a book card in `BookCard.tsx` opens the document viewer directly (`handleOpen`), and there is nowhere to see a book's full description, its genres, its series position, or other books by the same author without opening the file itself.

## Decomposition context (not built here)

For traceability, the full set of requests this doc's parent brainstorm decomposed into:

1. **Book Detail Page** - this doc.
2. **Cover art display** - real cover image instead of the colored gradient placeholder, on cards and on this Detail page.
3. **Legacy flagging + republish/migrate flow** - flag pre-v1.3.0 (pre-marker) books as Legacy, give owners a one-click way to republish them under the current identifier/marker scheme.
4. **Genre browsing** - chip-filter on Browse (the deferred "Plan 2" genre filter from `2026-07-22-book-collections-design.md`).
5. **Series pages** - a page listing every book in a series in order (the deferred "Plan 2" series pages/badges).
6. **Deep linking** - a URL that opens the library app straight to a specific book or series. Depends on #1 and #5 existing as routes.

**Reading-position/resume was explicitly cut from this batch of work.** `OPEN_QDN_DOCUMENT_VIEWER` (`qortium-home/work/electron/qdn.ts:9039`) takes no position parameter and has no return channel, and the document viewer's own `page` state (`qortium-home/work/src/DocumentViewer.tsx`) is unpersisted local state reset to `1` on every open. There is currently no way, even indirectly, for this app to open a book at a specific page or learn what page a reader was on. Automatic resume would require a qortium-home bridge change and is out of scope for this repo.

Sub-projects 2-6 are separate specs, built in the order above. This doc is scoped to #1 only.

## Goals

- A dedicated page for a single book: full title, genres, series position (if any), full description, author, file type/size, publish date, and the same Open/Download/Bookmark actions available on the card today.
- Clicking a book card navigates here instead of opening the document viewer directly.
- Works as a standalone page load (deep link, browser refresh, or a fresh navigation with no prior in-memory data), not just as a client-side transition from Browse.
- A "More from `<author>`" section, so a reader can discover other books by the same publisher without leaving the page.
- Leaves clear extension points for sub-projects 2, 3, and 5 to build on without needing to redesign this page.

## Non-goals

- No real cover art - this page uses the same gradient/file-icon placeholder `BookCard.tsx` uses today (`TypeBadge.tsx`'s `getTypeCoverGradient`). Covered by sub-project 2.
- No legacy badge and no "update to new format" action. Covered by sub-project 3.
- No genre-browse links (clicking a genre chip does nothing yet - chips are display-only). Covered by sub-project 4.
- No series page and no link from the series badge to one (the badge is text-only: "Foundation · Book 2 of 7", not a link). Covered by sub-project 5.
- No special deep-link handling beyond the route existing and working as a normal page load. Covered by sub-project 6.
- No "same series" or "same genre" related-books section - only "more by this author," per user decision during brainstorming (series/genre-powered relations wait until sub-projects 4-5 exist to power them properly).

## Route

`/book/:name/:identifier`, added as a sibling to the existing routes in `src/routes/Routes.tsx`:

```tsx
{ path: 'book/:name/:identifier', element: <BookDetailPage /> },
```

Both segments are URL-encoded on the way in (`encodeURIComponent`) and decoded on the way out, mirroring `UserPage.tsx`'s handling of `/user/:name`.

## Data loading

`BookDetailPage` fetches its own data on mount via the existing `getResource(service, name, identifier)` in `src/api/qortal.ts:60`, keyed off the decoded route params. `service` is always `'DOCUMENT'` - this page only ever renders books, which are exclusively published under that service (see `PublishPage.tsx` and `BrowsePage.tsx`'s `isReadable` filter).

This mirrors `UserPage.tsx`, which does its own independent fetch on mount rather than reaching into `BrowsePage`'s in-memory result list. The alternative - passing the already-fetched `QdnResource` through React Router's navigation state from `BookCard`, falling back to `getResource()` only when that state is absent - would save one round-trip on the common "clicked from Browse" path, but adds a second code path to keep in sync for a performance gain that hasn't been shown to matter at this app's scale. Fetch-on-mount is simpler, consistent with the existing codebase pattern, and correct uniformly across every entry point (card click, deep link, browser refresh, back/forward navigation).

States:
- **Loading**: centered `CircularProgress`, same as `UserPage.tsx`.
- **Not found**: `getResource` resolves `null` when the resource genuinely doesn't exist for that `(service, name, identifier)` triple (bad identifier, deleted resource, or a mistyped deep link). Render the existing `EmptyState` component with a "Back to Browse" button (`navigate('/')`).

## Page content

Reuses existing data helpers throughout - no new parsing logic:

- **Cover area**: same gradient background + centered file-type icon as `BookCard.tsx` (`getTypeCoverGradient`, `fileIcon`), sized larger for a detail view.
- **Title**: `getResourceTitle(resource)` - already prefers the marker's full untruncated title.
- **Author**: `resource.name`, a link to `/user/${encodeURIComponent(resource.name)}` (existing route, existing pattern from `BookCard.tsx`'s `handleAuthorClick`).
- **Genre chips**: decode the marker via `decodeDescription`, map each `genres` slug through `genreLabel()` from `src/lib/genres.ts`. Display-only (no click behavior) per Non-goals.
- **Series badge**: if the marker has a `series` field, render "`seriesTitle` · Book `pos` of `of`" (omit "of `of`" when `of` is absent) as static text, not a link.
- **Description**: the marker's `freeText` (or `getResourceDescription(resource)` when there's no marker at all), rendered as the book's blurb. Never render the raw `::qlib::{...}` block - `decodeDescription` already strips it.
- **Metadata row**: file type (`getResourceFileType`, via the existing `TypeBadge` component), size (`formatBytes`), publish date (`formatDate` on `resource.created`).
- **Actions**: Open (`openDocumentViewer`), Download (`saveQdnResource`), Bookmark toggle (`useBookmarks` hook) - the same three handlers `BookCard.tsx` already implements, lifted to this page as the primary actions (no hover-to-reveal; they're always visible here).

## Related books

A "More from `<author>`" section below the main content:

- Fetched via `listResources(resource.name, 'DOCUMENT')`, filtered with the same `isReadable` predicate `UserPage.tsx` uses (`getResourceFileType(r) !== 'unknown'`).
- Excludes the current book (`identifier !== resource.identifier`).
- Capped at 6 results, rendered via the existing `BookGrid` component.
- A "View all" link to `/user/${encodeURIComponent(resource.name)}` for the full list.
- If the author has no other readable books, the section doesn't render (no empty-state noise on a single-book author's page).

## Card click behavior change

`BookCard.tsx`'s outer `Box`'s `onClick` changes from `handleOpen` to a navigation to `/book/${encodeURIComponent(resource.name)}/${encodeURIComponent(resource.identifier)}`. The existing hover-overlay "Open" button keeps its own `handleOpen` with `e.stopPropagation()` (already present), so it continues to open the document viewer directly without navigating. Download and Bookmark buttons are unaffected - they already stop propagation.

## Testing

This page is UI-heavy with no pure-logic surface of its own (all parsing/formatting is delegated to existing, already-tested `src/lib` and `src/types` functions). Per the project's existing testing pattern (`2026-07-22-book-collections-foundation.md`, Task 10), verification here is a manual pass against a running dev server: navigate from Browse, from a User page, via a direct URL with a known-good `name`/`identifier`, and via a URL with a bad identifier (confirms the not-found state).

## Open questions / follow-ups (not blocking this design)

- Whether "More from `<author>`" should exclude books already in a series with the current book (to avoid redundancy once Series Pages exist and can show that grouping better) - deferred to sub-project 5.
- Whether the Detail page needs its own "Publish date" distinct from "Last updated" once the Legacy Republish flow (sub-project 3) can update an existing resource's metadata without changing its identifier - deferred to sub-project 3.
