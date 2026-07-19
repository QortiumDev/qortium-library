import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Button, CircularProgress, IconButton, Tooltip, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PersonIcon from '@mui/icons-material/Person';
import { useColors } from '../theme/ColorTokensContext';
import { tokens } from '../theme/tokens';
import { type QdnResource, getResourceFileType } from '../types';
import { listResources } from '../api/qortal';
import { BookGrid } from '../components/books/BookGrid';
import { EmptyState } from '../components/shared/EmptyState';

const PAGE_SIZE = 40;
// The DOCUMENT service is shared with other apps (forum posts, notifications,
// votes, etc.) that vastly outnumber actual book publishes, so a raw fetch of
// PAGE_SIZE resources yields far fewer than PAGE_SIZE actual books. Sift
// through raw batches this large at a time until enough books are found.
const RAW_BATCH = 200;
const MAX_RAW_SCAN = 3000;

function isReadable(r: QdnResource): boolean {
  return getResourceFileType(r) !== 'unknown';
}

export function UserPage() {
  const c        = useColors();
  const navigate = useNavigate();
  const { name } = useParams<{ name: string }>();

  const [resources,   setResources]   = useState<QdnResource[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore,     setHasMore]     = useState(false);
  const [offset,      setOffset]      = useState(0);
  const didInit = useRef(false);

  const decodedName = name ? decodeURIComponent(name) : '';

  async function load(replace: boolean, startOffset: number) {
    if (!decodedName) return;
    if (replace) setLoading(true); else setLoadingMore(true);

    let rawOffset = startOffset;
    let scanned = 0;
    let exhausted = false;
    const collected: QdnResource[] = [];

    while (collected.length < PAGE_SIZE && scanned < MAX_RAW_SCAN) {
      const res = await listResources(decodedName, 'DOCUMENT', rawOffset, RAW_BATCH);
      rawOffset += res.length;
      scanned += res.length;
      collected.push(...res.filter(isReadable));
      if (res.length < RAW_BATCH) { exhausted = true; break; }
    }

    if (replace) {
      setResources(collected);
    } else {
      setResources(prev => [...prev, ...collected]);
    }
    setOffset(rawOffset);
    setHasMore(!exhausted);
    if (replace) setLoading(false); else setLoadingMore(false);
  }

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    void load(true, 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decodedName]);

  return (
    <Box sx={{ pt: `calc(var(--library-top-bar-height, ${tokens.spacing.topBarHeight}px) + 28px)`, pb: 6, px: { xs: 2, md: 3 } }}>

      {/* Back + header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <Tooltip title="Back">
          <IconButton
            onClick={() => navigate(-1)}
            sx={{
              color: c.textSecondary,
              borderRadius: `${tokens.shape.radius}px`,
              '&:hover': { color: c.accent, bgcolor: c.borderLight },
            }}
          >
            <ArrowBackIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Box sx={{
          width: 40, height: 40, borderRadius: '50%',
          bgcolor: c.borderLight,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <PersonIcon sx={{ fontSize: '1.2rem', color: c.textSecondary }} />
        </Box>

        <Box>
          <Typography sx={{
            fontWeight: tokens.typography.weightBlack,
            fontSize: '1.25rem',
            letterSpacing: '-0.02em',
            color: c.textPrimary,
            lineHeight: 1.1,
          }}>
            {decodedName}
          </Typography>
          <Typography sx={{ fontSize: '0.7rem', color: c.textSecondary }}>
            Published documents
          </Typography>
        </Box>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
          <CircularProgress size={28} sx={{ color: c.accent }} />
        </Box>
      ) : resources.length === 0 ? (
        <EmptyState
          Icon={PersonIcon}
          title="No documents found"
          subtitle={`${decodedName} hasn't published any readable documents yet`}
        />
      ) : (
        <BookGrid resources={resources} />
      )}

      {!loading && hasMore && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <Button
            variant="outlined"
            onClick={() => void load(false, offset)}
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
