import { Box, Button, CircularProgress, Typography } from '@mui/material';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import PersonIcon from '@mui/icons-material/Person';
import { useAtomValue } from 'jotai';
import { useColors } from '../theme/ColorTokensContext';
import { tokens } from '../theme/tokens';
import { type QdnResource } from '../types';
import { accountAtom } from '../state/atoms';
import { useBookmarks } from '../hooks/useBookmarks';
import { BookGrid } from '../components/books/BookGrid';
import { EmptyState } from '../components/shared/EmptyState';

export function LibraryPage() {
  const c        = useColors();
  const account  = useAtomValue(accountAtom);
  const { bookmarks, isLoaded, isSaving } = useBookmarks();

  const asResources: QdnResource[] = bookmarks.map(b => ({
    service:    b.service,
    name:       b.name,
    identifier: b.identifier,
    title:      b.title,
  }));

  const noName = account !== null && !account.name;

  return (
    <Box sx={{ pt: `${tokens.spacing.topBarHeight + 28}px`, pb: 6, px: { xs: 2, md: 3 } }}>

      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography sx={{
            fontWeight: tokens.typography.weightBlack,
            fontSize: '1.5rem',
            letterSpacing: '-0.02em',
            color: c.textPrimary,
            lineHeight: 1,
            mb: 0.5,
          }}>
            My Library
          </Typography>
          <Typography sx={{ fontSize: '0.75rem', color: c.textSecondary }}>
            {account?.name
              ? `Saved to ${account.name}`
              : 'Sign in to sync your library across devices'}
          </Typography>
        </Box>

        {isSaving && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <CircularProgress size={12} sx={{ color: c.textSecondary }} />
            <Typography sx={{ fontSize: '0.65rem', color: c.textSecondary }}>Saving...</Typography>
          </Box>
        )}
      </Box>

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
            Register a Qortium name to sync your library across devices.
          </Typography>
        </Box>
      )}

      {!isLoaded ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
          <CircularProgress size={28} sx={{ color: c.accent }} />
        </Box>
      ) : asResources.length === 0 ? (
        <EmptyState
          Icon={BookmarkIcon}
          title="Your library is empty"
          subtitle="Save documents from Browse to build your collection"
          action={
            <Button
              variant="contained"
              disableElevation
              href="#/"
              sx={{
                bgcolor: c.accent, color: c.accentText,
                borderRadius: '50px', px: 3, fontSize: '0.72rem',
                '&:hover': { bgcolor: c.accentHover },
              }}
            >
              Browse documents
            </Button>
          }
        />
      ) : (
        <BookGrid resources={asResources} />
      )}
    </Box>
  );
}
