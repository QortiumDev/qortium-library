import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Button, Chip, CircularProgress,
  InputAdornment, TextField, Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import LocalLibraryIcon from '@mui/icons-material/LocalLibrary';
import { useColors } from '../theme/ColorTokensContext';
import { tokens } from '../theme/tokens';
import { type QdnResource, type FileType, getResourceFileType } from '../types';
import { searchResources } from '../api/qortal';
import { BookGrid } from '../components/books/BookGrid';
import { EmptyState } from '../components/shared/EmptyState';

// Default number of books shown on first load / new search.
const INITIAL_LOAD = 40;
// Books shown per pagination group, and the number of further books fetched
// once the user pages past what's already loaded.
const GROUP_SIZE = 40;
// The DOCUMENT service is shared with other apps (forum posts, notifications,
// votes, etc.) that vastly outnumber actual book publishes, so a raw fetch of
// GROUP_SIZE resources yields far fewer than GROUP_SIZE actual books. Sift
// through raw batches this large at a time until enough books are found.
const RAW_BATCH = 200;
// Safety cap on how many raw resources a single load will scan through
// looking for books, so a page with very few real books doesn't spin forever.
const MAX_RAW_SCAN = 3000;
// Resources this app published carry this tag (see PublishPage), so a
// keyword-scoped search returns almost entirely valid books without the
// DOCUMENT-service noise - no raw-batch scanning needed for that portion.
const BOOK_TAG = 'qlib-book';

function getPageWindow(current: number, total: number): (number | 'ellipsis')[] {
  const keep = new Set<number>([0, total - 1, current]);
  if (current - 1 >= 0) keep.add(current - 1);
  if (current + 1 <= total - 1) keep.add(current + 1);
  const sorted = Array.from(keep).filter(n => n >= 0 && n < total).sort((a, b) => a - b);
  const out: (number | 'ellipsis')[] = [];
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1] > 1) out.push('ellipsis');
    out.push(n);
  });
  return out;
}

type TypeFilter = 'all' | FileType;

const TYPE_CHIPS: { value: TypeFilter; label: string }[] = [
  { value: 'all',     label: 'All'    },
  { value: 'pdf',     label: 'PDF'    },
  { value: 'epub',    label: 'EPUB'   },
  { value: 'txt',     label: 'TXT'    },
  { value: 'cbz',     label: 'Comics' },
];

const SORT_CHIPS: { value: 'newest' | 'oldest'; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
];

function isReadable(r: QdnResource): boolean {
  return getResourceFileType(r) !== 'unknown';
}

export function BrowsePage() {
  const c = useColors();

  const [queryInput,   setQueryInput]   = useState('');
  const [activeQuery,  setActiveQuery]  = useState('');
  const [typeFilter,   setTypeFilter]   = useState<TypeFilter>('all');
  const [sortMode,     setSortMode]     = useState<'newest' | 'oldest'>('newest');
  const [allResults,   setAllResults]   = useState<QdnResource[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [loadingMore,  setLoadingMore]  = useState(false);
  const [hasMore,      setHasMore]      = useState(false);
  const [page,         setPage]         = useState(0);
  const didInit = useRef(false);
  // Two independent pagination cursors - one for the fast tagged-book search,
  // one for the raw DOCUMENT scan - so a search can draw from both across
  // successive "load more" calls without either resetting the other.
  const cursorRef = useRef({ tagOffset: 0, rawOffset: 0, tagExhausted: false, rawExhausted: false });

  const displayResults = typeFilter === 'all'
    ? allResults
    : allResults.filter(r => getResourceFileType(r) === typeFilter);

  const sortedResults = sortMode === 'newest'
    ? displayResults
    : [...displayResults].reverse();

  const totalPages = Math.max(1, Math.ceil(sortedResults.length / GROUP_SIZE));
  const pageResults = sortedResults.slice(page * GROUP_SIZE, page * GROUP_SIZE + GROUP_SIZE);
  const canGoNext = page < totalPages - 1 || hasMore;

  const doSearch = useCallback(async (query: string, replace: boolean, target: number) => {
    if (replace) setLoading(true); else setLoadingMore(true);
    if (replace) cursorRef.current = { tagOffset: 0, rawOffset: 0, tagExhausted: false, rawExhausted: false };

    const cursor = cursorRef.current;
    const collected: QdnResource[] = [];

    // Fast path: pull from the tagged-book cursor first.
    if (!cursor.tagExhausted) {
      const need = target - collected.length;
      const res = await searchResources({
        service:  'DOCUMENT',
        keywords: [BOOK_TAG],
        query:    query || undefined,
        limit:    need,
        offset:   cursor.tagOffset,
      });
      cursor.tagOffset += res.length;
      collected.push(...res.filter(isReadable));
      if (res.length < need) cursor.tagExhausted = true;
    }

    // Fallback: books published without the tag (older uploads, other
    // tools) still need a raw DOCUMENT scan filtered client-side by type.
    // Tagged resources are excluded here since the fast path already found them.
    let scanned = 0;
    while (collected.length < target && !cursor.rawExhausted && scanned < MAX_RAW_SCAN) {
      const res = await searchResources({
        service: 'DOCUMENT',
        query:   query || undefined,
        limit:   RAW_BATCH,
        offset:  cursor.rawOffset,
      });
      cursor.rawOffset += res.length;
      scanned += res.length;
      collected.push(...res.filter(r => isReadable(r) && !r.tags?.includes(BOOK_TAG)));
      if (res.length < RAW_BATCH) { cursor.rawExhausted = true; break; }
    }

    if (replace) {
      setAllResults(collected);
    } else {
      setAllResults(prev => {
        const seen = new Set(prev.map(r => `${r.service}::${r.name}::${r.identifier}`));
        const fresh = collected.filter(r => !seen.has(`${r.service}::${r.name}::${r.identifier}`));
        return [...prev, ...fresh];
      });
    }
    setHasMore(!cursor.tagExhausted || !cursor.rawExhausted);
    if (replace) setLoading(false); else setLoadingMore(false);
  }, []);

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    void doSearch('', true, INITIAL_LOAD);
  }, [doSearch]);

  function handleSearch() {
    setActiveQuery(queryInput);
    setPage(0);
    void doSearch(queryInput, true, INITIAL_LOAD);
  }

  async function goToPage(target: number) {
    if (target === page || target < 0) return;
    if (target >= totalPages && hasMore) {
      await doSearch(activeQuery, false, GROUP_SIZE);
    }
    setPage(target);
  }

  function handleTypeFilter(value: TypeFilter) {
    setTypeFilter(value);
    setPage(0);
  }

  function handleSortMode(value: 'newest' | 'oldest') {
    setSortMode(value);
    setPage(0);
  }

  const chipSx = (active: boolean) => ({
    fontSize: '0.63rem',
    fontWeight: tokens.typography.weightBold,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    borderRadius: '50px',
    cursor: 'pointer',
    height: 26,
    bgcolor: active ? c.accent : 'transparent',
    color:   active ? c.accentText : c.textSecondary,
    border:  `1.5px solid ${active ? c.accent : c.borderLight}`,
    '&:hover': { bgcolor: active ? c.accentHover : c.borderLight },
    transition: '0.12s ease',
  });

  const pageBtnSx = (active: boolean) => ({
    minWidth: 32,
    width: 32,
    height: 32,
    p: 0,
    borderRadius: '50%',
    fontSize: '0.72rem',
    fontWeight: tokens.typography.weightBold,
    bgcolor: active ? c.accent : 'transparent',
    color:   active ? c.accentText : c.textSecondary,
    border:  `1.5px solid ${active ? c.accent : c.borderLight}`,
    '&:hover': { bgcolor: active ? c.accentHover : c.borderLight },
    '&.Mui-disabled': { opacity: 0.35 },
    transition: '0.12s ease',
  });

  return (
    <Box sx={{ pt: `calc(var(--library-top-bar-height, ${tokens.spacing.topBarHeight}px) + 28px)`, pb: 6, px: { xs: 2, md: 3 } }}>

      {/* Header */}
      <Box sx={{ mb: 3, maxWidth: 560 }}>
        <Typography sx={{
          fontWeight: tokens.typography.weightBlack,
          fontSize: '1.5rem',
          letterSpacing: '-0.02em',
          color: c.textPrimary,
          lineHeight: 1,
          mb: 0.5,
        }}>
          Browse
        </Typography>
        <Typography sx={{ fontSize: '0.75rem', color: c.textSecondary }}>
          Discover reading materials published on Qortium
        </Typography>
      </Box>

      {/* Search bar */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2.5, maxWidth: 640 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Search by title, author, or keyword..."
          value={queryInput}
          onChange={e => setQueryInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: '1rem', color: c.textSecondary }} />
                </InputAdornment>
              ),
            },
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              fontSize: '0.85rem',
              '& fieldset': { borderColor: c.borderLight },
              '&:hover fieldset': { borderColor: c.accent },
              '&.Mui-focused fieldset': { borderColor: c.accent },
            },
          }}
        />
        <Button
          variant="contained"
          disableElevation
          onClick={handleSearch}
          disabled={loading}
          sx={{
            bgcolor: c.accent, color: c.accentText,
            borderRadius: '50px', px: 2.5, fontSize: '0.72rem', whiteSpace: 'nowrap',
            '&:hover': { bgcolor: c.accentHover },
            '&.Mui-disabled': { opacity: 0.4, bgcolor: c.accent, color: c.accentText },
          }}
        >
          Search
        </Button>
      </Box>

      {/* Filter row */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap', mb: 3 }}>
        {TYPE_CHIPS.map(({ value, label }) => (
          <Chip
            key={value}
            label={label}
            size="small"
            onClick={() => handleTypeFilter(value)}
            sx={chipSx(typeFilter === value)}
          />
        ))}

        <Box sx={{ width: '1px', height: 14, bgcolor: c.borderLight, mx: 0.5, display: { xs: 'none', sm: 'block' } }} />

        {SORT_CHIPS.map(({ value, label }) => (
          <Chip
            key={value}
            label={label}
            size="small"
            onClick={() => handleSortMode(value)}
            sx={chipSx(sortMode === value)}
          />
        ))}

        {allResults.length > 0 && !loading && (
          <Typography sx={{ fontSize: '0.65rem', color: c.textSecondary, ml: 'auto' }}>
            {sortedResults.length} result{sortedResults.length !== 1 ? 's' : ''}
          </Typography>
        )}
      </Box>

      {/* Results */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
          <CircularProgress size={28} sx={{ color: c.accent }} />
        </Box>
      ) : sortedResults.length === 0 ? (
        <EmptyState
          Icon={LocalLibraryIcon}
          title="No documents found"
          subtitle={activeQuery ? `No results for "${activeQuery}"` : 'Try searching for a title, author, or topic'}
        />
      ) : (
        <BookGrid resources={pageResults} />
      )}

      {/* Pagination */}
      {!loading && sortedResults.length > 0 && (totalPages > 1 || hasMore) && (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mt: 4 }}>
          <Button
            onClick={() => void goToPage(page - 1)}
            disabled={page === 0 || loadingMore}
            sx={pageBtnSx(false)}
          >
            <ChevronLeftIcon sx={{ fontSize: '1.1rem' }} />
          </Button>

          {getPageWindow(page, totalPages).map((p, i) =>
            p === 'ellipsis' ? (
              <Typography key={`e${i}`} sx={{ fontSize: '0.72rem', color: c.textSecondary, px: 0.5 }}>
                &hellip;
              </Typography>
            ) : (
              <Button
                key={p}
                onClick={() => void goToPage(p)}
                disabled={loadingMore}
                sx={pageBtnSx(p === page)}
              >
                {p + 1}
              </Button>
            )
          )}

          <Button
            onClick={() => void goToPage(page + 1)}
            disabled={!canGoNext || loadingMore}
            sx={pageBtnSx(false)}
          >
            {loadingMore
              ? <CircularProgress size={12} sx={{ color: c.accent }} />
              : <ChevronRightIcon sx={{ fontSize: '1.1rem' }} />}
          </Button>
        </Box>
      )}
    </Box>
  );
}
