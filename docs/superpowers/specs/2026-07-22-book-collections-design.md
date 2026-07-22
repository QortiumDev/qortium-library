# Book Collections: Genres, Series & Playlists

## Problem

Three related issues surfaced while using the Publish flow:

1. **Titles get truncated.** Qortium Core's `title` metadata field is hard-capped at 80 bytes UTF-8 (`ArbitraryDataTransactionMetadata.MAX_TITLE_LENGTH`) and silently trims anything longer - there's no error, the data is just gone.
2. **Series show up out of order.** Books in a series are independent DOCUMENT resources with no relationship to each other, so Browse has no way to group or order them.
3. **Republishing the same book creates a duplicate instead of overwriting.** `PublishPage.tsx` derives the QDN `identifier` from a slugified filename plus a random UUID suffix (`b.id.slice(0, 8)`, regenerated every time a file is added to the publish queue). Since QDN only overwrites on an exact `(service, name, identifier)` match, and the suffix is different every publish, every republish of the same book mints a brand-new resource.

This doc also adds genre tagging and reader-curated playlists, which came up as related asks during design.

## Goals

- Fix duplicate-on-republish by making `identifier` deterministic.
- Give books a genre (multi-select, max 4) and, optionally, series membership with a display order.
- Never truncate a title inside the app, even though Core's on-chain `title` field is capped.
- Keep every book fully self-describing: rendering a book's title, genre, and series info must never depend on a second resource fetch succeeding.
- Let readers build personal named playlists across any author's books.
- Tell the publisher clearly, at publish time, when something won't fit - never silently drop data.

## Non-goals

- No cross-author series merging (two authors can each have their own "Foundation" series; they never collide because series lookups are scoped by publisher name).
- No moderated/shared genre or series taxonomy - genres are a fixed in-app list for v1; series are entirely author-defined.
- No migration of already-published duplicate/old-format books - the user is deleting those manually.
- No "edit metadata on an already-published book" flow in this pass (noted as a follow-up under Open Questions).

## Qortium Core constraints (source of truth for every byte budget below)

From `ArbitraryTransaction.java` and `ArbitraryDataTransactionMetadata.java`:

| Field | Limit | Enforcement |
|---|---|---|
| `identifier` | 64 bytes UTF-8 | rejected at broadcast time (opaque error) if exceeded |
| `title` | 80 bytes UTF-8 | **silently trimmed** by Core if exceeded |
| `description` | 240 bytes UTF-8 | silently trimmed by Core if exceeded |
| `tags` | 5 tags max, 20 bytes each | excess tags dropped, oversized tag rejected |

## Identifier scheme (fixes duplicate-on-republish)

```
identifier = "qlib-" + <hash> + <original file extension>
```

- `"qlib-"` (5 bytes) replaces the `qlib-book` tag as the app's discovery marker - moving it into the identifier frees a tag slot (5 available instead of 4) and lets Browse find every library book with a single server-side prefix search instead of scanning the DOCUMENT service.
- `<hash>` is the first 12 hex chars (48 bits) of `crypto.subtle.digest('SHA-256', filename)` (Web Crypto, already available in-browser - no new dependency). Same filename in → same hash → same identifier → Core treats republish as a new version of the same resource (overwrite). A different filename produces a different identifier (new resource), which matches the intuitive "same file = same book" model.
- The extension (`.pdf`, `.epub`, etc.) is preserved on the end. `types/index.ts::getFileType()` parses the identifier's extension as a fallback when `metadata.mimeType` is absent - dropping the extension would quietly break that fallback for any resource where mimeType isn't available.
- Total length is far under the 64-byte cap (`qlib-` + 12 hex chars + `.epub` ≈ 22 bytes), so there's no truncation risk here.
- Collision risk is a non-issue: identifiers only need to be unique within one publisher's own catalog (QDN keys on `(service, name, identifier)`), not globally.

This replaces the current `toIdentifier()` in `PublishPage.tsx`, which uses a slugified title base plus a random per-upload UUID suffix.

## Data model: self-describing books

Every book resource carries all of its own display data. No second resource has to load successfully for a book to render its correct title, genre, or series position - the only thing that requires a second resource is a reader's personal playlist (see below), which is optional and non-blocking by design.

**`title`** - kept as a short, safe fallback label (auto-derived, ≤ 77 chars + "…" if needed, computed by the app - the publisher never has to think about the 80-byte cap). Not the source of truth for the real title.

**`description`** - author's free-text blurb, followed by a machine-managed marker block the app appends at submit time:

```
<free-text description the author typed>

::qlib::{"title":"<full untruncated title>","series":"foundation","seriesTitle":"Foundation","pos":2,"of":7,"genres":["sci-fi","adventure"]}
```

- The publish form never exposes this marker as editable text. The Description field is free text only; genre and series come from separate structured controls (dropdown, series picker). The app assembles the final string at submit time.
- On load, the app looks for the `::qlib::{...}` marker and parses it if present. Missing or malformed → render normally with no series/genre badge, exactly like a book published by another tool or before this feature existed. Nothing breaks.
- The block consumes roughly 60-100 bytes of the 240-byte description budget depending on names chosen. The publish form shows a live byte counter for the free-text portion that already accounts for the block's current size. If free text would overflow the remaining budget, the app trims it client-side *before* appending the block (with a visible warning) - the block itself is never truncated, since a cut mid-JSON would corrupt the parse.
- A future "edit an already-published book" flow (out of scope here) would decode this block back into the same structured form controls - never expose raw marker text for hand-editing.

**`tags`** - pure discovery pointers, not the source of truth for display data:
- `series:<slug>` (1 slot, only if a series is set)
- `genre:<slug>` (up to 4 slots, flat cap regardless of whether a series is set - max total tags used: 5)

## Genre taxonomy

Fixed, flat, in-app list (a plain array in source - editing it later is a one-line change, no data migration):

Sci-Fi (`sci-fi`) · Fantasy (`fantasy`) · Mystery/Thriller (`mystery`) · Horror (`horror`) · Romance (`romance`) · Adventure (`adventure`) · Historical Fiction (`hist-fiction`) · History/Humanities (`history`) · Memoir/Biography (`memoir-bio`) · True Crime (`true-crime`) · Self-Help (`self-help`) · How-To/DIY (`how-to-diy`) · Blueprint/Diagram (`blueprint`) · Business (`business`) · Philosophy (`philosophy`) · Science (`science`) · Occult (`occult`) · Recipe (`recipe`) · Poetry (`poetry`) · Comics/Graphic Novel (`graphic-novel`) · Children's (`childrens`) · Young Adult (`young-adult`) · Humor (`humor`) · Reference (`reference`) · Religion/Spirituality (`spirituality`) · Travel (`travel`)

26 entries. Every slug is ≤ 14 bytes, fitting the 20-byte tag budget with the `genre:` prefix (`Mystery/Thriller`'s slug is shortened to `mystery` alone - `mystery-thriller` would have been 16 bytes, over budget).

Publish form: multi-select, hard cap of 4 selections. Once 4 are picked, remaining options gray out with a tooltip explaining the cap - never silently drop a 5th selection at submit time.

## Series metadata

- **Display name** (free text, no length constraint - lives only in the description block, never a tag).
- **Slug** (auto-derived from the display name, must fit the 20-byte tag budget with the `series:` prefix). If slugifying can't produce something that fits (very long or all-non-Latin input), block publish with a clear error rather than silently dropping the tag.
- **Position** (required once a series is chosen, positive integer). Block publish if series is set but position is missing or invalid.
- **Total** (optional "of N" - the author may not know the final count for an ongoing series).
- Autocomplete for series name/slug is drawn from the author's own previously-published series, so re-adding to an existing series doesn't accidentally fork into a second slug via a typo.

## Publish form validation summary

| Condition | Behavior |
|---|---|
| Title empty | Block |
| Account has no registered name | Block (existing behavior) |
| More than 4 genres selected | UI prevents it (grayed out), not a submit-time error |
| Genre slug doesn't fit tag budget | Block, clear error (should be rare given fixed list) |
| Series set, position missing/invalid | Block |
| Series slug doesn't fit tag budget | Block, clear error |
| Free-text description would overflow the byte budget once the marker block is added | Auto-trim client-side, visible warning, non-blocking |
| Title longer than the safe on-chain label length | No warning needed - handled transparently by auto-deriving the short label; full title is always preserved in the description block |

## Browse changes

- **Discovery**: replace the current two-tier "tag search, then scan up to 3000 raw DOCUMENT resources" fallback (`RAW_BATCH`/`MAX_RAW_SCAN` in `BrowsePage.tsx`) with a single `identifier=qlib-&prefix=true&service=DOCUMENT` server-side prefix search. This is possible because `/arbitrary/resources/search` supports genuine prefix matching on `identifier` (`ArbitraryResource.java`), and Qortium Home's bridge forwards `identifier`/`prefix` straight through. Books published under the old identifier scheme won't match this prefix - acceptable since those are being manually cleaned up.
- **Genre filter**: a chip row styled like the existing type/sort filters, single-select, "All" default. Selecting a genre does a tag-keyword search the same way the existing `qlib-book` fast path works today.
- **Series badge**: a book card whose parsed marker block has a `series` shows a small badge under the title - "Foundation · Book 2 of 7" - linking to `/series/:author/:slug`.
- **Series page**: fetches the given author's `qlib-`-prefixed resources (name-scoped, so two authors' same-named series never collide), parses each one's marker block client-side, filters to the matching series slug, sorts by `pos`.

## Reader playlists

Kept fully separate from the existing bookmark ("quick save") feature - bookmarks stay exactly as they work today. Playlists are a new, named-folder layer:

- New resource `qlib-playlists` (per-reader, same pattern as the existing `qlib-bookmarks`): `{ version: 1, playlists: [{ id, name, items: [{ service, name, identifier, title, filename, addedAt }] }] }`.
- `My Library` gains a second tab: **Saved** (today's bookmark grid, unchanged) and **Playlists** (list of named folders the reader creates; opening one renders the same `BookGrid` component filtered to that folder's items).
- Adding a book to a playlist happens from a small menu on the book card, next to the existing bookmark star.
- Same failure story as bookmarks today: if `qlib-playlists` fails to load, the reader just doesn't see their folders that session. The books themselves are self-describing (per the data model above) and render correctly regardless.

## Open questions / follow-ups (not blocking this design)

- An "edit metadata on an already-published book" flow - republishing today only supports full re-upload; changing just genre/series/description on an existing resource without re-uploading the file isn't covered here.
- Whether genre list should eventually move from a hardcoded array to something the user can edit without a code change - deferred; hardcoded is simpler and the user asked to keep the list basic and adjust it directly.
