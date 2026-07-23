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

    if (!decodedName || !decodedIdentifier) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setLoading(true);
    setNotFound(false);

    void getResource('DOCUMENT', decodedName, decodedIdentifier).then(res => {
      if (loadedKey.current !== key) return;
      setResource(res);
      setNotFound(res === null);
      setLoading(false);

      if (res) {
        void listResources(decodedName, 'DOCUMENT').then(all => {
          if (loadedKey.current !== key) return;
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

  const handleOpen = async () => {
    setOpening(true);
    try {
      await openDocumentViewer(resource.service, resource.name, resource.identifier, null, resource.identifier);
    } catch { /* Home not available outside Qortium */ }
    finally { setOpening(false); }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      if (!await ensureAccountUnlocked()) return;
      await saveQdnResource(resource.service, resource.name, resource.identifier, resource.identifier);
    } catch { /* ignore */ }
    finally { setDownloading(false); }
  };

  const handleBookmark = async () => {
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
  };

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
