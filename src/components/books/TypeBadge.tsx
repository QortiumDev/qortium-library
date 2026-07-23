import { Box } from '@mui/material';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import ArticleIcon from '@mui/icons-material/Article';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import DescriptionIcon from '@mui/icons-material/Description';
import type { FileType } from '../../types';

const TYPE_COLORS: Record<FileType, { bg: string; text: string }> = {
  pdf:     { bg: '#C0392B', text: '#fff' },
  epub:    { bg: '#2a79f3', text: '#fff' },
  txt:     { bg: '#4D6478', text: '#fff' },
  cbz:     { bg: '#7b44da', text: '#fff' },
  unknown: { bg: '#888',    text: '#fff' },
};

const TYPE_LABELS: Record<FileType, string> = {
  pdf:     'PDF',
  epub:    'EPUB',
  txt:     'TXT',
  cbz:     'CBZ',
  unknown: '?',
};

export function TypeBadge({ type, small }: { type: FileType; small?: boolean }) {
  const { bg, text } = TYPE_COLORS[type];
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        bgcolor: bg,
        color: text,
        fontSize: small ? '0.55rem' : '0.62rem',
        fontWeight: 700,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        px: small ? 0.6 : 0.75,
        py: small ? 0.1 : 0.2,
        borderRadius: '4px',
        lineHeight: 1.6,
        userSelect: 'none',
        flexShrink: 0,
      }}
    >
      {TYPE_LABELS[type]}
    </Box>
  );
}

export function getTypeCoverGradient(type: FileType, accent: string, accentHover: string): string {
  switch (type) {
    case 'pdf':  return 'linear-gradient(145deg, #c0392b, #e74c3c)';
    case 'epub': return 'linear-gradient(145deg, #1a64d0, #17a398)';
    case 'txt':  return 'linear-gradient(145deg, #4D6478, #6B7D8E)';
    case 'cbz':  return 'linear-gradient(145deg, #6433b5, #9B59B6)';
    default:     return `linear-gradient(145deg, ${accent}, ${accentHover})`;
  }
}

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
