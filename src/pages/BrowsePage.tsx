import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Button, Chip, CircularProgress,
  InputAdornment, TextField, Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import LocalLibraryIcon from '@mui/icons-material/LocalLibrary';
import { useColors } from '../theme/ColorTokensContext';
import { tokens } from '../theme/tokens';
import { type QdnResource, type FileType, getFileType } from '../types';
import { searchResources } from '../api/qortal';
import { BookGrid } from '../components/books/BookGrid';
import { EmptyState } from '../components/shared/EmptyState';

const PAGE_SIZE = 40;

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
  const t = getFileType(r.identifier);
  return t !== 'unknown';
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
  const [offset,       setOffset]       = useState(0);
  const didInit = useRef(false);

  const displayResults = typeFilter === 'all'
    ? allResults
    : allResults.filter(r => getFileType(r.identifier) === typeFilter);

  const sortedResults = sortMode === 'newest'
    ? displayResults
    : [...displayResults].reverse();

  const doSearch = useCallback(async (query: string, replace: boolean, currentOffset: number) => {
    if (replace) setLoading(true); else setLoadingMore(true);

    const res = await searchResources({
      service: 'DOCUMENT',
      query:   query || undefined,
      limit:   PAGE_SIZE,
      offset:  currentOffset,
    });

    const readable = res.filter(isReadable);

    if (replace) {
      setAllResults(readable);
      setOffset(res.length);
    } else {
      setAllResults(prev => {
        const seen = new Set(prev.map(r => `${r.service}::${r.name}::${r.identifier}`));
        const fresh = readable.filter(r => !seen.has(`${r.service}::${r.name}::${r.identifier}`));
        return [...prev, ...fresh];
      });
      setOffset(o => o + res.length);
    }
    setHasMore(res.length === PAGE_SIZE);
    if (replace) setLoading(false); else setLoadingMore(false);
  }, []);

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    void doSearch('', true, 0);
  }, [doSearch]);

  function handleSearch() {
    setActiveQuery(queryInput);
    setOffset(0);
    void doSearch(queryInput, true, 0);
  }

  function handleLoadMore() {
    void doSearch(activeQuery, false, offset);
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

  return (
    <Box sx={{ pt: `${tokens.spacing.topBarHeight + 28}px`, pb: 6, px: { xs: 2, md: 3 } }}>

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
            onClick={() => setTypeFilter(value)}
            sx={chipSx(typeFilter === value)}
          />
        ))}

        <Box sx={{ width: '1px', height: 14, bgcolor: c.borderLight, mx: 0.5, display: { xs: 'none', sm: 'block' } }} />

        {SORT_CHIPS.map(({ value, label }) => (
          <Chip
            key={value}
            label={label}
            size="small"
            onClick={() => setSortMode(value)}
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
        <BookGrid resources={sortedResults} />
      )}

      {/* Load more */}
      {!loading && hasMore && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <Button
            variant="outlined"
            onClick={handleLoadMore}
            disabled={loadingMore}
            sx={{
              borderColor: c.accent, color: c.accent,
              borderRadius: '50px', fontSize: '0.72rem', px: 3,
              '&:hover': { bgcolor: c.borderLight },
              '&.Mui-disabled': { opacity: 0.35 },
            }}
          >
            {loadingMore
              ? <CircularProgress size={14} sx={{ color: c.accent }} />
              : 'Load more'}
          </Button>
        </Box>
      )}
    </Box>
  );
}
