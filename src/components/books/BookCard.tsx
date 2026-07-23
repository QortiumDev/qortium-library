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

export function BookCard({ resource }: { resource: QdnResource }) {
  const c        = useColors();
  const navigate = useNavigate();
  const { has, add, remove } = useBookmarks();

  const [hovered,     setHovered]     = useState(false);
  const [opening,     setOpening]     = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [bookmarking, setBookmarking] = useState(false);

  const fileType     = getResourceFileType(resource);
  const isBookmarked = has(resource.service, resource.name, resource.identifier);
  const title        = getResourceTitle(resource);

  const gradient = getTypeCoverGradient(fileType, c.accent, c.accentHover);

  function handleCardClick() {
    navigate(`/book/${encodeURIComponent(resource.name)}/${encodeURIComponent(resource.identifier)}`);
  }

  async function handleOpen(e: MouseEvent) {
    e.stopPropagation();
    setOpening(true);
    try {
      await openDocumentViewer(resource.service, resource.name, resource.identifier, null, resource.identifier);
    } catch { /* Home not available outside Qortium */ }
    finally { setOpening(false); }
  }

  async function handleDownload(e: MouseEvent) {
    e.stopPropagation();
    setDownloading(true);
    try {
      if (!await ensureAccountUnlocked()) return;
      await saveQdnResource(resource.service, resource.name, resource.identifier, resource.identifier);
    } catch { /* ignore */ }
    finally { setDownloading(false); }
  }

  async function handleBookmark(e: MouseEvent) {
    e.stopPropagation();
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

  function handleAuthorClick(e: MouseEvent) {
    e.stopPropagation();
    navigate(`/user/${encodeURIComponent(resource.name)}`);
  }

  return (
    <Box
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        borderRadius: `${tokens.shape.radius}px`,
        overflow: 'hidden',
        border: `${tokens.shape.borderWidth} solid ${c.borderLight}`,
        bgcolor: c.surface,
        cursor: 'pointer',
        transform: hovered ? 'translateY(-2px)' : 'none',
        boxShadow: hovered ? `0 8px 24px rgba(0,0,0,0.12)` : 'none',
        transition: '0.2s ease',
      }}
      onClick={handleCardClick}
    >
      {/* Cover */}
      <Box sx={{ position: 'relative', aspectRatio: '2/3', background: gradient, overflow: 'hidden' }}>

        {/* Spine highlight */}
        <Box sx={{
          position: 'absolute', top: 0, left: 0, bottom: 0, width: 6,
          background: 'rgba(255,255,255,0.15)',
        }} />

        {/* File icon centered */}
        <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {fileIcon(fileType)}
        </Box>

        {/* Type badge - bottom left */}
        <Box sx={{ position: 'absolute', bottom: 8, left: 8 }}>
          <TypeBadge type={fileType} small />
        </Box>

        {/* Bookmark button - top right */}
        <Tooltip title={isBookmarked ? 'Remove from library' : 'Save to library'} placement="top">
          <span style={{ position: 'absolute', top: 6, right: 6, zIndex: 2 }}>
            <IconButton
              size="small"
              onClick={handleBookmark}
              disabled={bookmarking}
              sx={{
                bgcolor: 'rgba(0,0,0,0.45)',
                color: isBookmarked ? '#f5c518' : 'rgba(255,255,255,0.8)',
                padding: '5px',
                '&:hover': { bgcolor: 'rgba(0,0,0,0.65)' },
                transition: '0.15s ease',
              }}
            >
              {bookmarking
                ? <CircularProgress size={14} sx={{ color: '#fff' }} />
                : isBookmarked
                  ? <BookmarkIcon sx={{ fontSize: '1rem' }} />
                  : <BookmarkBorderIcon sx={{ fontSize: '1rem' }} />}
            </IconButton>
          </span>
        </Tooltip>

        {/* Hover overlay */}
        <Box sx={{
          position: 'absolute', inset: 0,
          bgcolor: 'rgba(0,0,0,0.52)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1,
          opacity: hovered ? 1 : 0,
          transition: '0.2s ease',
        }}>
          <Button
            variant="contained"
            disableElevation
            onClick={handleOpen}
            disabled={opening}
            sx={{
              bgcolor: '#fff', color: '#111',
              borderRadius: '50px', px: 2.5,
              fontSize: '0.7rem', fontWeight: 700,
              minWidth: 88,
              '&:hover': { bgcolor: 'rgba(255,255,255,0.9)' },
              '&.Mui-disabled': { opacity: 0.5 },
            }}
          >
            {opening ? <CircularProgress size={12} sx={{ color: '#333' }} /> : 'Open'}
          </Button>

          <Tooltip title="Download" placement="bottom">
            <span>
              <IconButton
                size="small"
                onClick={handleDownload}
                disabled={downloading}
                sx={{
                  color: 'rgba(255,255,255,0.7)',
                  '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.15)' },
                }}
              >
                {downloading
                  ? <CircularProgress size={14} sx={{ color: '#fff' }} />
                  : <DownloadIcon sx={{ fontSize: '1rem' }} />}
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      </Box>

      {/* Info */}
      <Box sx={{ p: 1.25, flex: 1, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
        <Typography sx={{
          fontSize: '0.8rem',
          fontWeight: tokens.typography.weightBold,
          color: c.textPrimary,
          lineHeight: 1.35,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {title}
        </Typography>

        <Typography
          onClick={handleAuthorClick}
          sx={{
            fontSize: '0.7rem',
            fontWeight: tokens.typography.weightMedium,
            color: c.accent,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            cursor: 'pointer',
            '&:hover': { textDecoration: 'underline' },
            mt: 0.25,
          }}
        >
          {resource.name}
        </Typography>

        {resource.size !== undefined && (
          <Typography sx={{ fontSize: '0.62rem', color: c.textSecondary, mt: 'auto', pt: 0.5 }}>
            {formatBytes(resource.size)}
          </Typography>
        )}
      </Box>
    </Box>
  );
}
