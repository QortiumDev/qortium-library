import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Button, CircularProgress, IconButton, Tooltip, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PersonIcon from '@mui/icons-material/Person';
import { useColors } from '../theme/ColorTokensContext';
import { tokens } from '../theme/tokens';
import { type QdnResource, getFileType } from '../types';
import { listResources } from '../api/qortal';
import { BookGrid } from '../components/books/BookGrid';
import { EmptyState } from '../components/shared/EmptyState';

const PAGE_SIZE = 40;

function isReadable(r: QdnResource): boolean {
  return getFileType(r.identifier) !== 'unknown';
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

  async function load(replace: boolean, currentOffset: number) {
    if (!decodedName) return;
    if (replace) setLoading(true); else setLoadingMore(true);

    const res = await listResources(decodedName, 'DOCUMENT', currentOffset, PAGE_SIZE);
    const readable = res.filter(isReadable);

    if (replace) {
      setResources(readable);
      setOffset(res.length);
    } else {
      setResources(prev => [...prev, ...readable]);
      setOffset(o => o + res.length);
    }
    setHasMore(res.length === PAGE_SIZE);
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
