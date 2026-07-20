import { useState, useRef, useCallback, type DragEvent, type ChangeEvent } from 'react';
import {
  Box, Button, CircularProgress, IconButton,
  TextField, Tooltip, Typography,
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import ArticleIcon from '@mui/icons-material/Article';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import DescriptionIcon from '@mui/icons-material/Description';
import PersonIcon from '@mui/icons-material/Person';
import { useAtomValue } from 'jotai';
import { useColors } from '../theme/ColorTokensContext';
import { tokens } from '../theme/tokens';
import { getFileType, type FileType } from '../types';
import { accountAtom } from '../state/atoms';
import { fileToBase64, publishMultipleResources, ensureAccountUnlocked } from '../api/qortal';
import { TypeBadge } from '../components/books/TypeBadge';

const ACCEPTED = ['.pdf', '.epub', '.txt', '.cbz'];
const ACCEPT_ATTR = ACCEPTED.join(',');

type UploadStatus = 'pending' | 'publishing' | 'done' | 'error';

interface PendingBook {
  id:          string;
  file:        File;
  fileType:    FileType;
  title:       string;
  description: string;
  status:      UploadStatus;
  errorMsg?:   string;
}

function titleFromFilename(name: string): string {
  return name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ').trim();
}

function FileTypeIcon({ type }: { type: FileType }) {
  const sx = { fontSize: '1.1rem', color: 'inherit' };
  switch (type) {
    case 'pdf':  return <PictureAsPdfIcon sx={sx} />;
    case 'epub': return <MenuBookIcon     sx={sx} />;
    case 'txt':  return <ArticleIcon      sx={sx} />;
    case 'cbz':  return <AutoStoriesIcon  sx={sx} />;
    default:     return <DescriptionIcon  sx={sx} />;
  }
}

function statusIcon(status: UploadStatus, c: ReturnType<typeof useColors>) {
  switch (status) {
    case 'publishing': return <CircularProgress size={16} sx={{ color: c.accent }} />;
    case 'done':       return <CheckCircleIcon  sx={{ fontSize: '1rem', color: c.success }} />;
    case 'error':      return <ErrorIcon        sx={{ fontSize: '1rem', color: c.error  }} />;
    default:           return null;
  }
}

export function PublishPage() {
  const c       = useColors();
  const account = useAtomValue(accountAtom);

  const [books,      setBooks]      = useState<PendingBook[]>([]);
  const [dragging,   setDragging]   = useState(false);
  const [publishing, setPublishing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files);
    const valid = arr.filter(f => {
      const ext = '.' + (f.name.split('.').pop()?.toLowerCase() ?? '');
      return ACCEPTED.includes(ext);
    });
    setBooks(prev => [
      ...prev,
      ...valid.map(f => ({
        id:          crypto.randomUUID(),
        file:        f,
        fileType:    getFileType(f.name),
        title:       titleFromFilename(f.name),
        description: '',
        status:      'pending' as UploadStatus,
      })),
    ]);
  }, []);

  function onDragOver(e: DragEvent) {
    e.preventDefault();
    setDragging(true);
  }
  function onDragLeave() { setDragging(false); }
  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  }
  function onInputChange(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files) addFiles(e.target.files);
    e.target.value = '';
  }

  function updateBook(id: string, patch: Partial<PendingBook>) {
    setBooks(prev => prev.map(b => b.id === id ? { ...b, ...patch } : b));
  }

  function removeBook(id: string) {
    setBooks(prev => prev.filter(b => b.id !== id));
  }

  async function handlePublishAll() {
    if (!account?.name || books.length === 0) return;
    setPublishing(true);

    const pending = books.filter(b => b.status === 'pending');
    setBooks(prev => prev.map(b => b.status === 'pending' ? { ...b, status: 'publishing' } : b));

    try {
      if (!await ensureAccountUnlocked()) return;
      const resources = await Promise.all(
        pending.map(async b => ({
          service:     'DOCUMENT',
          name:        account.name as string,
          identifier:  b.file.name,
          data64:      await fileToBase64(b.file),
          filename:    b.file.name,
          title:       b.title.trim() || undefined,
          description: b.description.trim() || undefined,
          tags:        ['qlib-book'],
        }))
      );

      await publishMultipleResources(resources);

      setBooks(prev => prev.map(b =>
        b.status === 'publishing' ? { ...b, status: 'done' } : b
      ));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Publish failed';
      setBooks(prev => prev.map(b =>
        b.status === 'publishing' ? { ...b, status: 'error', errorMsg: msg } : b
      ));
    } finally {
      setPublishing(false);
    }
  }

  const pendingCount = books.filter(b => b.status === 'pending').length;
  const doneCount    = books.filter(b => b.status === 'done').length;
  const noName       = account !== null && !account.name;

  return (
    <Box sx={{ pt: `calc(var(--library-top-bar-height, ${tokens.spacing.topBarHeight}px) + 28px)`, pb: 6, px: { xs: 2, md: 3 }, maxWidth: 760, mx: 'auto' }}>

      <Box sx={{ mb: 3 }}>
        <Typography sx={{
          fontWeight: tokens.typography.weightBlack,
          fontSize: '1.5rem',
          letterSpacing: '-0.02em',
          color: c.textPrimary,
          lineHeight: 1,
          mb: 0.5,
        }}>
          Publish
        </Typography>
        <Typography sx={{ fontSize: '0.75rem', color: c.textSecondary }}>
          Share reading materials on Qortium - PDF, EPUB, TXT, and CBZ
        </Typography>
      </Box>

      {/* No-name notice */}
      {noName && (
        <Box sx={{
          mb: 3, px: 2, py: 1.5,
          bgcolor: `${c.accent}12`,
          border: `1px solid ${c.accent}30`,
          borderRadius: `${tokens.shape.radius}px`,
          display: 'flex', alignItems: 'center', gap: 1,
        }}>
          <PersonIcon sx={{ fontSize: '0.9rem', color: c.accent, flexShrink: 0 }} />
          <Typography sx={{ fontSize: '0.75rem', color: c.accent }}>
            You need a registered Qortium name to publish documents.
          </Typography>
        </Box>
      )}

      {/* Drop zone */}
      <Box
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        sx={{
          border: `${tokens.shape.borderWidth} dashed ${dragging ? c.accent : c.borderLight}`,
          borderRadius: `${tokens.shape.radius}px`,
          bgcolor: dragging ? `${c.accent}08` : c.surface,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 1, py: 4, px: 3,
          cursor: 'pointer',
          transition: '0.15s ease',
          mb: books.length > 0 ? 2.5 : 0,
          '&:hover': { borderColor: c.accent, bgcolor: `${c.accent}06` },
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPT_ATTR}
          style={{ display: 'none' }}
          onChange={onInputChange}
        />
        <UploadFileIcon sx={{ fontSize: '2rem', color: dragging ? c.accent : c.textSecondary, opacity: dragging ? 1 : 0.4 }} />
        <Box sx={{ textAlign: 'center' }}>
          <Typography sx={{ fontSize: '0.85rem', fontWeight: tokens.typography.weightBold, color: c.textPrimary }}>
            {dragging ? 'Drop to add' : 'Drop files here or click to browse'}
          </Typography>
          <Typography sx={{ fontSize: '0.7rem', color: c.textSecondary, mt: 0.25 }}>
            PDF, EPUB, TXT, CBZ - multiple files supported
          </Typography>
        </Box>
      </Box>

      {/* Book queue */}
      {books.length > 0 && (
        <Box sx={{
          border: `${tokens.shape.borderWidth} solid ${c.borderLight}`,
          borderRadius: `${tokens.shape.radius}px`,
          bgcolor: c.surface,
          overflow: 'hidden',
          mb: 2.5,
        }}>
          {books.map((book, i) => (
            <Box
              key={book.id}
              sx={{
                px: 2, py: 1.75,
                borderBottom: i < books.length - 1 ? `1px solid ${c.borderLight}` : 'none',
                opacity: book.status === 'done' ? 0.6 : 1,
                transition: '0.2s ease',
              }}
            >
              {/* Row header */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: book.status === 'pending' ? 1.25 : 0 }}>
                <Box sx={{ color: c.textSecondary, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                  <FileTypeIcon type={book.fileType} />
                </Box>
                <TypeBadge type={book.fileType} small />
                <Typography sx={{
                  fontSize: '0.8rem',
                  fontWeight: tokens.typography.weightMedium,
                  color: c.textPrimary,
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {book.file.name}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                  {statusIcon(book.status, c)}
                  {book.status === 'pending' && (
                    <Tooltip title="Remove">
                      <IconButton
                        size="small"
                        onClick={() => removeBook(book.id)}
                        sx={{
                          color: c.textSecondary,
                          borderRadius: `${tokens.shape.radius}px`,
                          p: 0.5,
                          '&:hover': { color: c.error, bgcolor: c.borderLight },
                          transition: '0.12s ease',
                        }}
                      >
                        <CloseIcon sx={{ fontSize: '0.9rem' }} />
                      </IconButton>
                    </Tooltip>
                  )}
                  {book.status === 'done' && (
                    <Typography sx={{ fontSize: '0.65rem', color: c.success, fontWeight: tokens.typography.weightBold }}>
                      Published
                    </Typography>
                  )}
                  {book.status === 'error' && (
                    <Typography sx={{ fontSize: '0.65rem', color: c.error }}>
                      {book.errorMsg ?? 'Failed'}
                    </Typography>
                  )}
                </Box>
              </Box>

              {/* Editable metadata (only when pending) */}
              {book.status === 'pending' && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, pl: 4 }}>
                  <TextField
                    size="small"
                    fullWidth
                    label="Title"
                    value={book.title}
                    onChange={e => updateBook(book.id, { title: e.target.value })}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        fontSize: '0.8rem',
                        '& fieldset': { borderColor: c.borderLight },
                        '&:hover fieldset': { borderColor: c.accent },
                        '&.Mui-focused fieldset': { borderColor: c.accent },
                      },
                      '& .MuiInputLabel-root': { fontSize: '0.78rem' },
                    }}
                  />
                  <TextField
                    size="small"
                    fullWidth
                    label="Description (optional)"
                    value={book.description}
                    onChange={e => updateBook(book.id, { description: e.target.value })}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        fontSize: '0.8rem',
                        '& fieldset': { borderColor: c.borderLight },
                        '&:hover fieldset': { borderColor: c.accent },
                        '&.Mui-focused fieldset': { borderColor: c.accent },
                      },
                      '& .MuiInputLabel-root': { fontSize: '0.78rem' },
                    }}
                  />
                </Box>
              )}
            </Box>
          ))}
        </Box>
      )}

      {/* Actions row */}
      {books.length > 0 && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          {pendingCount > 0 && (
            <Button
              variant="text"
              startIcon={<AddIcon />}
              onClick={() => fileInputRef.current?.click()}
              sx={{
                color: c.textSecondary,
                fontSize: '0.72rem',
                borderRadius: '50px',
                '&:hover': { color: c.accent, bgcolor: c.borderLight },
              }}
            >
              Add more
            </Button>
          )}

          {doneCount > 0 && pendingCount === 0 && (
            <Button
              variant="text"
              onClick={() => setBooks([])}
              sx={{
                color: c.textSecondary,
                fontSize: '0.72rem',
                borderRadius: '50px',
                '&:hover': { color: c.accent, bgcolor: c.borderLight },
              }}
            >
              Clear
            </Button>
          )}

          {pendingCount > 0 && (
            <Button
              variant="contained"
              disableElevation
              onClick={() => void handlePublishAll()}
              disabled={publishing || noName || !account}
              sx={{
                ml: 'auto',
                bgcolor: c.accent, color: c.accentText,
                borderRadius: '50px', px: 3, fontSize: '0.78rem',
                '&:hover': { bgcolor: c.accentHover },
                '&.Mui-disabled': { opacity: 0.4, bgcolor: c.accent, color: c.accentText },
              }}
            >
              {publishing
                ? <><CircularProgress size={12} sx={{ color: c.accentText, mr: 1 }} /> Publishing...</>
                : `Publish ${pendingCount} ${pendingCount === 1 ? 'book' : 'books'}`}
            </Button>
          )}
        </Box>
      )}
    </Box>
  );
}
