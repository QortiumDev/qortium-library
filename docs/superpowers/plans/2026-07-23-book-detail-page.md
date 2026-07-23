# Book Detail Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/book/:name/:identifier` page that shows a single book's full details (title, genres, series position, description, metadata, and Open/Download/Bookmark actions) plus a "More from this author" section, and make book cards navigate there instead of opening the document viewer directly.

**Architecture:** One new page component, `BookDetailPage.tsx`, wired into the existing hash router alongside `UserPage.tsx`. It reuses every data helper the app already has (`getResourceTitle`, `getResourceFileType`, `decodeDescription`, `genreLabel`, `formatBytes`, `formatDate`) and the same `getResource`/`listResources` API functions `UserPage.tsx` already uses for its own independent fetch-on-mount. The one small shared-code change is lifting `fileIcon` out of `BookCard.tsx` into `TypeBadge.tsx` so both the card and the new detail page can use it without duplicating the type-to-icon switch.

**Tech Stack:** React 19 + TypeScript + MUI 7 + react-router-dom (existing, no new dependencies).

This implements `docs/superpowers/specs/2026-07-23-book-detail-page-design.md` only. Cover art, legacy flagging/republish, genre-browse links, series pages, and deep-link handling are separate specs and out of scope here - see that spec's "Decomposition context" section.

**On testing:** This project has Vitest wired up (see `docs/superpowers/plans/2026-07-22-book-collections-foundation.md`) but no component-test infrastructure (no React Testing Library) - the existing plan's precedent (its Task 10) is to verify UI-only changes with a manual dev-server pass instead of inventing new test infra. Every piece of parsing/formatting logic this plan touches (`decodeDescription`, `getResourceTitle`, `genreLabel`, `formatBytes`, `formatDate`) already has Vitest coverage from that prior plan and isn't changed here, so this plan follows the same manual-verification precedent rather than adding component tests.

---

## File Structure

**New files:**
- `src/pages/BookDetailPage.tsx` - the detail page: fetch-on-mount, loading/not-found states, book info, actions, related books.

**Modified files:**
- `src/components/books/TypeBadge.tsx` - gains an exported `fileIcon()` function (moved from `BookCard.tsx`) so both the card and the detail page can render a type icon without duplicating the switch statement.
- `src/components/books/BookCard.tsx` - removes its local `fileIcon()` and now imports it from `TypeBadge.tsx`; click handler changes from opening the document viewer to navigating to the book's detail page.
- `src/routes/Routes.tsx` - adds the `/book/:name/:identifier` route.

---

## Task 1: Move `fileIcon` into `TypeBadge.tsx`

`BookCard.tsx` currently defines a local `fileIcon(type: FileType)` helper (lines 19-28) that switches on file type to render a centered icon. `BookDetailPage.tsx` needs the same icon at a larger size for its cover area. Rather than duplicate the switch statement, move it into `TypeBadge.tsx` (which already owns `getTypeCoverGradient`, the other piece of "how a book's cover looks" logic) as an exported function that takes an optional font size.

**Files:**
- Modify: `src/components/books/TypeBadge.tsx`
- Modify: `src/components/books/BookCard.tsx:1-28`

- [ ] **Step 1: Add the icon imports and `fileIcon` export to `TypeBadge.tsx`**

At the top of `src/components/books/TypeBadge.tsx`, replace:

```tsx
import { Box } from '@mui/material';
import type { FileType } from '../../types';
```

with:

```tsx
import { Box } from '@mui/material';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import ArticleIcon from '@mui/icons-material/Article';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import DescriptionIcon from '@mui/icons-material/Description';
import type { FileType } from '../../types';
```

Then, at the end of the file, after `getTypeCoverGradient`, add:

```tsx

export function fileIcon(type: FileType, fontSize: string = '2.8rem') {
  const sx = { fontSize, color: 'rgba(255,255,255,0.35)' };
  switch (type) {
    case 'pdf':  return <PictureAsPdfIcon sx={sx} />;
    case 'epub': return <MenuBookIcon     sx={sx} />;
    case 'txt':  return <ArticleIcon      sx={sx} />;
    case 'cbz':  return <AutoStoriesIcon  sx={sx} />;
    default:     return <DescriptionIcon  sx={sx} />;
  }
}
```

- [ ] **Step 2: Remove the local `fileIcon` from `BookCard.tsx` and import it from `TypeBadge.tsx`**

Replace lines 1-28 of `src/components/books/BookCard.tsx`:

```tsx
import { useState, type MouseEvent } from 'react';
import { Box, Button, CircularProgress, IconButton, Tooltip, Typography } from '@mui/material';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import ArticleIcon from '@mui/icons-material/Article';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import DescriptionIcon from '@mui/icons-material/Description';
import DownloadIcon from '@mui/icons-material/Download';
import { useNavigate } from 'react-router-dom';
import { useColors } from '../../theme/ColorTokensContext';
import { tokens } from '../../theme/tokens';
import { type QdnResource, type FileType, getResourceFileType, getResourceTitle, formatBytes } from '../../types';
import { useBookmarks } from '../../hooks/useBookmarks';
import { openDocumentViewer, saveQdnResource, ensureAccountUnlocked } from '../../api/qortal';
import { TypeBadge, getTypeCoverGradient } from './TypeBadge';

function fileIcon(type: FileType) {
  const sx = { fontSize: '2.8rem', color: 'rgba(255,255,255,0.35)' };
  switch (type) {
    case 'pdf':  return <PictureAsPdfIcon sx={sx} />;
    case 'epub': return <MenuBookIcon     sx={sx} />;
    case 'txt':  return <ArticleIcon      sx={sx} />;
    case 'cbz':  return <AutoStoriesIcon  sx={sx} />;
    default:     return <DescriptionIcon  sx={sx} />;
  }
}
```

with:

```tsx
import { useState, type MouseEvent } from 'react';
import { Box, Button, CircularProgress, IconButton, Tooltip, Typography } from '@mui/material';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import DownloadIcon from '@mui/icons-material/Download';
import { useNavigate } from 'react-router-dom';
import { useColors } from '../../theme/ColorTokensContext';
import { tokens } from '../../theme/tokens';
import { type QdnResource, getResourceFileType, getResourceTitle, formatBytes } from '../../types';
import { useBookmarks } from '../../hooks/useBookmarks';
import { openDocumentViewer, saveQdnResource, ensureAccountUnlocked } from '../../api/qortal';
import { TypeBadge, getTypeCoverGradient, fileIcon } from './TypeBadge';
```

- [ ] **Step 3: Verify the project type-checks**

Run: `npx tsc -b --noEmit`
Expected: no errors. (`fileIcon(fileType)` is still called the same way further down in `BookCard.tsx` - the default `fontSize` parameter keeps that call site's behavior unchanged.)

- [ ] **Step 4: Commit**

```bash
git add src/components/books/TypeBadge.tsx src/components/books/BookCard.tsx
git commit -m "Move fileIcon into TypeBadge so it can be shared with the detail page"
```

---

## Task 2: Create `BookDetailPage.tsx` and wire the route

**Files:**
- Create: `src/pages/BookDetailPage.tsx`
- Modify: `src/routes/Routes.tsx`

- [ ] **Step 1: Create `src/pages/BookDetailPage.tsx`**

```tsx
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Button, CircularProgress, IconButton, Tooltip, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import DownloadIcon from '@mui/icons-material/Download';
import LocalLibraryIcon from '@mui/icons-material/LocalLibrary';
import { useColors } from '../theme/ColorTokensContext';
import { tokens } from '../theme/tokens';
import { type QdnResource, getResourceFileType, getResourceTitle, getResourceDescription, formatBytes, formatDate } from '../types';
import { decodeDescription } from '../lib/qlibMarker';
import { genreLabel } from '../lib/genres';
import { getResource, listResources, openDocumentViewer, saveQdnResource, ensureAccountUnlocked } from '../api/qortal';
import { useBookmarks } from '../hooks/useBookmarks';
import { BookGrid } from '../components/books/BookGrid';
import { TypeBadge, getTypeCoverGradient, fileIcon } from '../components/books/TypeBadge';
import { EmptyState } from '../components/shared/EmptyState';

// How many other books by the same author to show in "More from <author>" -
// enough to fill most of a row without needing its own pagination.
const RELATED_LIMIT = 6;

function isReadable(r: QdnResource): boolean {
  return getResourceFileType(r) !== 'unknown';
}

export function BookDetailPage() {
  const c        = useColors();
  const navigate = useNavigate();
  const { name, identifier } = useParams<{ name: string; identifier: string }>();
  const { has, add, remove } = useBookmarks();

  const [resource, setResource] = useState<QdnResource | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [related,  setRelated]  = useState<QdnResource[]>([]);

  const [opening,     setOpening]     = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [bookmarking, setBookmarking] = useState(false);

  const decodedName       = name       ? decodeURIComponent(name)       : '';
  const decodedIdentifier = identifier ? decodeURIComponent(identifier) : '';

  // Guards against re-fetching on every render while still re-fetching when
  // the route params actually change (e.g. navigating from one book's detail
  // page to a "more from this author" card on the same page instance).
  const loadedKey = useRef<string | null>(null);

  useEffect(() => {
    const key = `${decodedName}::${decodedIdentifier}`;
    if (loadedKey.current === key) return;
    loadedKey.current = key;
    if (!decodedName || !decodedIdentifier) return;

    setLoading(true);
    setNotFound(false);

    void getResource('DOCUMENT', decodedName, decodedIdentifier).then(res => {
      setResource(res);
      setNotFound(res === null);
      setLoading(false);

      if (res) {
        void listResources(decodedName, 'DOCUMENT').then(all => {
          setRelated(
            all
              .filter(r => isReadable(r) && r.identifier !== decodedIdentifier)
              .slice(0, RELATED_LIMIT)
          );
        });
      }
    });
  }, [decodedName, decodedIdentifier]);

  const pageSx = { pt: `calc(var(--library-top-bar-height, ${tokens.spacing.topBarHeight}px) + 28px)`, pb: 6, px: { xs: 2, md: 3 } };

  if (loading) {
    return (
      <Box sx={pageSx}>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
          <CircularProgress size={28} sx={{ color: c.accent }} />
        </Box>
      </Box>
    );
  }

  if (notFound || !resource) {
    return (
      <Box sx={pageSx}>
        <EmptyState
          Icon={LocalLibraryIcon}
          title="Book not found"
          subtitle="This book may have been removed, or the link is incorrect."
          action={
            <Button
              variant="outlined"
              onClick={() => navigate('/')}
              sx={{
                borderColor: c.accent, color: c.accent,
                borderRadius: '50px', fontSize: '0.72rem', px: 3,
                '&:hover': { bgcolor: c.borderLight },
              }}
            >
              Back to Browse
            </Button>
          }
        />
      </Box>
    );
  }

  const fileType     = getResourceFileType(resource);
  const isBookmarked = has(resource.service, resource.name, resource.identifier);
  const title        = getResourceTitle(resource);
  const gradient     = getTypeCoverGradient(fileType, c.accent, c.accentHover);

  const { freeText: description, marker } = decodeDescription(getResourceDescription(resource));
  const genres = marker?.genres ?? [];
  const seriesLabel = marker?.series
    ? `${marker.seriesTitle ?? marker.series}${marker.pos ? ` · Book ${marker.pos}${marker.of ? ` of ${marker.of}` : ''}` : ''}`
    : null;

  async function handleOpen() {
    setOpening(true);
    try {
      await openDocumentViewer(resource.service, resource.name, resource.identifier, null, resource.identifier);
    } catch { /* Home not available outside Qortium */ }
    finally { setOpening(false); }
  }

  async function handleDownload() {
    setDownloading(true);
    try {
      if (!await ensureAccountUnlocked()) return;
      await saveQdnResource(resource.service, resource.name, resource.identifier, resource.identifier);
    } catch { /* ignore */ }
    finally { setDownloading(false); }
  }

  async function handleBookmark() {
    setBookmarking(true);
    try {
      if (isBookmarked) {
        await remove(resource.service, resource.name, resource.identifier);
      } else {
        await add({
          service:    resource.service,
          name:       resource.name,
          identifier: resource.identifier,
          title,
          filename:   resource.identifier,
        });
      }
    } finally { setBookmarking(false); }
  }

  return (
    <Box sx={pageSx}>

      {/* Back */}
      <Tooltip title="Back">
        <IconButton
          onClick={() => navigate(-1)}
          sx={{
            color: c.textSecondary,
            borderRadius: `${tokens.shape.radius}px`,
            mb: 2,
            '&:hover': { color: c.accent, bgcolor: c.borderLight },
          }}
        >
          <ArrowBackIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 3, mb: 5 }}>

        {/* Cover */}
        <Box sx={{
          position: 'relative',
          width: { xs: '100%', sm: 200 },
          maxWidth: { xs: 260, sm: 200 },
          aspectRatio: '2/3',
          borderRadius: `${tokens.shape.radius}px`,
          overflow: 'hidden',
          background: gradient,
          flexShrink: 0,
        }}>
          <Box sx={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 6, background: 'rgba(255,255,255,0.15)' }} />
          <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {fileIcon(fileType, '4rem')}
          </Box>
        </Box>

        {/* Info */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{
            fontWeight: tokens.typography.weightBlack,
            fontSize: '1.6rem',
            letterSpacing: '-0.02em',
            color: c.textPrimary,
            lineHeight: 1.2,
            mb: 0.75,
          }}>
            {title}
          </Typography>

          <Typography
            onClick={() => navigate(`/user/${encodeURIComponent(resource.name)}`)}
            sx={{
              display: 'inline-block',
              fontSize: '0.85rem',
              fontWeight: tokens.typography.weightMedium,
              color: c.accent,
              cursor: 'pointer',
              mb: 1.5,
              '&:hover': { textDecoration: 'underline' },
            }}
          >
            {resource.name}
          </Typography>

          {(genres.length > 0 || seriesLabel) && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1.5 }}>
              {seriesLabel && (
                <Box sx={{
                  fontSize: '0.68rem', fontWeight: tokens.typography.weightBold,
                  color: c.accent, bgcolor: c.borderLight,
                  borderRadius: '50px', px: 1.25, py: 0.4,
                }}>
                  {seriesLabel}
                </Box>
              )}
              {genres.map(slug => (
                <Box key={slug} sx={{
                  fontSize: '0.68rem', fontWeight: tokens.typography.weightMedium,
                  color: c.textSecondary, border: `1px solid ${c.borderLight}`,
                  borderRadius: '50px', px: 1.25, py: 0.35,
                }}>
                  {genreLabel(slug)}
                </Box>
              ))}
            </Box>
          )}

          <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1.25, mb: 2 }}>
            <TypeBadge type={fileType} />
            {resource.size !== undefined && (
              <Typography sx={{ fontSize: '0.72rem', color: c.textSecondary }}>
                {formatBytes(resource.size)}
              </Typography>
            )}
            {resource.created !== undefined && (
              <Typography sx={{ fontSize: '0.72rem', color: c.textSecondary }}>
                Published {formatDate(resource.created)}
              </Typography>
            )}
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button
              variant="contained"
              disableElevation
              onClick={() => void handleOpen()}
              disabled={opening}
              sx={{
                bgcolor: c.accent, color: c.accentText,
                borderRadius: '50px', px: 3, fontSize: '0.78rem', fontWeight: 700,
                '&:hover': { bgcolor: c.accentHover },
                '&.Mui-disabled': { opacity: 0.5 },
              }}
            >
              {opening ? <CircularProgress size={14} sx={{ color: c.accentText }} /> : 'Open'}
            </Button>

            <Tooltip title="Download">
              <span>
                <IconButton
                  onClick={() => void handleDownload()}
                  disabled={downloading}
                  sx={{
                    color: c.textSecondary,
                    border: `1.5px solid ${c.borderLight}`,
                    '&:hover': { color: c.accent, bgcolor: c.borderLight },
                  }}
                >
                  {downloading
                    ? <CircularProgress size={14} sx={{ color: c.textSecondary }} />
                    : <DownloadIcon sx={{ fontSize: '1.1rem' }} />}
                </IconButton>
              </span>
            </Tooltip>

            <Tooltip title={isBookmarked ? 'Remove from library' : 'Save to library'}>
              <span>
                <IconButton
                  onClick={() => void handleBookmark()}
                  disabled={bookmarking}
                  sx={{
                    color: isBookmarked ? '#f5c518' : c.textSecondary,
                    border: `1.5px solid ${c.borderLight}`,
                    '&:hover': { bgcolor: c.borderLight },
                  }}
                >
                  {bookmarking
                    ? <CircularProgress size={14} sx={{ color: c.textSecondary }} />
                    : isBookmarked ? <BookmarkIcon sx={{ fontSize: '1.1rem' }} /> : <BookmarkBorderIcon sx={{ fontSize: '1.1rem' }} />}
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        </Box>
      </Box>

      {description && (
        <Box sx={{ maxWidth: 720, mb: 5 }}>
          <Typography sx={{ fontSize: '0.9rem', color: c.textPrimary, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
            {description}
          </Typography>
        </Box>
      )}

      {related.length > 0 && (
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', mb: 2 }}>
            <Typography sx={{ fontWeight: tokens.typography.weightBold, fontSize: '1.05rem', color: c.textPrimary }}>
              More from {resource.name}
            </Typography>
            <Typography
              onClick={() => navigate(`/user/${encodeURIComponent(resource.name)}`)}
              sx={{ fontSize: '0.75rem', color: c.accent, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
            >
              View all
            </Typography>
          </Box>
          <BookGrid resources={related} />
        </Box>
      )}
    </Box>
  );
}
```

- [ ] **Step 2: Wire the route into `Routes.tsx`**

In `src/routes/Routes.tsx`, add the import:

```tsx
import { BookDetailPage } from '../pages/BookDetailPage';
```

alongside the existing page imports (below `import { BrowsePage } from '../pages/BrowsePage';`).

Then add the route itself as a sibling to `user/:name`:

```tsx
      { index: true,             element: <BrowsePage />  },
      { path: 'publish',         element: <PublishPage /> },
      { path: 'library',         element: <LibraryPage /> },
      { path: 'user/:name',      element: <UserPage />    },
      { path: 'book/:name/:identifier', element: <BookDetailPage /> },
```

- [ ] **Step 3: Verify the project type-checks**

Run: `npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/pages/BookDetailPage.tsx src/routes/Routes.tsx
git commit -m "Add Book Detail Page"
```

---

## Task 3: Make book cards navigate to the detail page

**Files:**
- Modify: `src/components/books/BookCard.tsx`

- [ ] **Step 1: Add a card-click handler and use it on the card's outer `Box`**

In `src/components/books/BookCard.tsx`, find `handleOpen` (it currently starts with `async function handleOpen(e: MouseEvent) {`). Add a new handler right above it:

```tsx
  function handleCardClick() {
    navigate(`/book/${encodeURIComponent(resource.name)}/${encodeURIComponent(resource.identifier)}`);
  }

  async function handleOpen(e: MouseEvent) {
```

Then find the outer `Box`'s click handler:

```tsx
      onClick={handleOpen}
    >
      {/* Cover */}
```

Replace with:

```tsx
      onClick={handleCardClick}
    >
      {/* Cover */}
```

Leave the hover-overlay "Open" button's `onClick={handleOpen}` (further down in the file, inside the `Button` in the hover overlay) unchanged - it already calls `e.stopPropagation()` as the first line of `handleOpen`, so it keeps opening the document viewer directly without triggering the card's navigation.

- [ ] **Step 2: Verify the project type-checks**

Run: `npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/books/BookCard.tsx
git commit -m "Navigate to Book Detail Page on card click"
```

---

## Task 4: Manual verification

There's no component-test infrastructure in this project, so this UI needs a manual pass (same precedent as `2026-07-22-book-collections-foundation.md` Task 10).

- [ ] **Step 1: Run the full automated test suite to make sure nothing existing broke**

Run: `npx vitest run`
Expected: PASS - every existing test file still passes (this plan doesn't touch any tested module).

- [ ] **Step 2: Start the dev server**

Run: `npm run dev`
Expected: Vite prints a local URL (e.g. `http://localhost:5173`).

- [ ] **Step 3: Manually verify the detail page**

Since this app expects to run inside the Qortium Home bridge, `qdnRequest` calls (fetching real resources, opening the viewer, bookmarking) will fail or return empty outside it - that's expected. Verify what can be verified from the dev server alone:

- From Browse, click a book card: confirm the URL changes to `#/book/<name>/<identifier>` and the page renders a loading spinner, then either the book's details or a "Book not found" state (expected outside the bridge, since `getResource` has no real node to query).
- From a book card's hover overlay, click "Open" (not the card body): confirm it does *not* navigate to the detail page (no URL change), matching the "Open still opens the viewer directly" behavior from the spec.
- Navigate directly to `#/book/someauthor/some-identifier-that-does-not-exist` by typing the URL: confirm the "Book not found" `EmptyState` renders with a working "Back to Browse" button.
- Click the back button (top-left arrow) on the detail page: confirm it returns to the previous page.
- If reachable with a real Qortium Home connection and an author who has published more than one book: confirm the "More from `<author>`" section renders other books, excludes the current one, and its "View all" link goes to `/user/:name`.

- [ ] **Step 4: Stop the dev server**

Press `Ctrl+C` in the terminal running `npm run dev`.

- [ ] **Step 5: Final commit (if any manual fixes were needed)**

```bash
git add -A
git commit -m "Fix issues found during manual Book Detail Page verification"
```

If no fixes were needed, there's nothing to commit - this plan is complete.

---

## Self-Review Notes

- **Spec coverage:** route and fetch-on-mount data loading (Task 2, Step 1-2) · loading/not-found states (Task 2, Step 1) · title/author/genre chips/series badge/description/metadata row/actions (Task 2, Step 1) · "More from author" related books, capped at 6, excludes current book, hidden when empty (Task 2, Step 1) · card click navigates to detail page while hover "Open" still opens the viewer directly (Task 3) · explicitly no cover art, no legacy badge, no clickable genre chips, no clickable series badge, no deep-link-specific code (nothing in any task adds these). Manual verification (Task 4) matches the project's established no-RTL precedent.
- **Type consistency:** `fileIcon(type: FileType, fontSize?: string)` is defined once in `TypeBadge.tsx` (Task 1) and used with its default arg in `BookCard.tsx` (unchanged call site) and with an explicit size in `BookDetailPage.tsx` (Task 2). `QdnResource`, `getResourceTitle`, `getResourceFileType`, `getResourceDescription`, `formatBytes`, `formatDate` are all imported from `../types` as already defined - none redefined.
- **No placeholders:** every step has complete, runnable code - no "add styling here" or "handle the rest similarly" steps.
