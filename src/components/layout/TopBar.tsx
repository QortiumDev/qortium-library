import { useEffect, useState } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { Box, Chip, IconButton, Tooltip, Typography } from '@mui/material';
import LocalLibraryIcon from '@mui/icons-material/LocalLibrary';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1';
import PersonRemoveAlt1Icon from '@mui/icons-material/PersonRemoveAlt1';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { useNavigate, useLocation } from 'react-router-dom';
import { useColors } from '../../theme/ColorTokensContext';
import { tokens } from '../../theme/tokens';
import { themeAtom, accountAtom } from '../../state/atoms';
import { EnumTheme } from '../../types';
import { RatingControl } from './RatingControl';

const APP_QDN_NAME = 'Library';

export function TopBar() {
  const c = useColors();
  const [theme, setTheme] = useAtom(themeAtom);
  const account   = useAtomValue(accountAtom);
  const navigate  = useNavigate();
  const location  = useLocation();
  const [isFollowed, setIsFollowed] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);

  useEffect(() => {
    qdnRequest({ action: 'GET_LIST', listName: 'followedNames' })
      .then((list) => { setIsFollowed(Array.isArray(list) && (list as string[]).includes(APP_QDN_NAME)); })
      .catch(() => {});
  }, []);

  async function handleToggleFollow() {
    if (followBusy) return;
    setFollowBusy(true);
    try {
      if (isFollowed) {
        await qdnRequest({ action: 'REMOVE_FROM_LIST', listName: 'followedNames', items: [APP_QDN_NAME] });
        setIsFollowed(false);
      } else {
        await qdnRequest({ action: 'ADD_TO_LIST', listName: 'followedNames', items: [APP_QDN_NAME] });
        setIsFollowed(true);
      }
    } catch {}
    setFollowBusy(false);
  }

  function handleOpenHelp() {
    void qdnRequest({ action: 'OPEN_NEW_TAB', address: `qdn://APP/Help/Help?new=${APP_QDN_NAME}` });
  }

  const isBrowse  = location.pathname === '/' || location.pathname.startsWith('/user/');
  const isPublish = location.pathname === '/publish';
  const isLibrary = location.pathname === '/library';

  const chipSx = (active: boolean) => ({
    fontSize: '0.65rem',
    fontWeight: tokens.typography.weightBold,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    borderRadius: '50px',
    cursor: 'pointer',
    height: 28,
    bgcolor: active ? c.accent : 'transparent',
    color:   active ? c.accentText : c.textSecondary,
    border:  `1.5px solid ${active ? c.accent : c.borderLight}`,
    '&:hover': { bgcolor: active ? c.accentHover : c.borderLight },
    transition: '0.12s ease',
  });

  return (
    <Box
      component="header"
      sx={{
        position: 'fixed', top: 0, left: 0, right: 0,
        height: tokens.spacing.topBarHeight,
        bgcolor: c.surface,
        borderBottom: `${tokens.shape.borderWidth} solid ${c.borderLight}`,
        display: 'flex', alignItems: 'center',
        px: 2, gap: 1, zIndex: 100,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mr: 'auto' }}>
        <LocalLibraryIcon sx={{ fontSize: '1.1rem', color: c.accent }} />
        <Typography sx={{
          fontWeight: tokens.typography.weightBlack,
          fontSize: '1rem',
          color: c.textPrimary,
          letterSpacing: '-0.01em',
        }}>
          Library
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', gap: 0.75 }}>
        <Chip
          label="Browse"
          size="small"
          onClick={() => navigate('/')}
          sx={chipSx(isBrowse)}
        />
        <Chip
          label="Publish"
          size="small"
          onClick={() => navigate('/publish')}
          sx={chipSx(isPublish)}
        />
        <Chip
          label="My Library"
          size="small"
          onClick={() => navigate('/library')}
          sx={chipSx(isLibrary)}
        />
      </Box>

      {account?.name && (
        <Typography sx={{
          fontSize: '0.7rem',
          fontWeight: tokens.typography.weightMedium,
          color: c.textSecondary,
          ml: 0.5,
          maxWidth: 120,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {account.name}
        </Typography>
      )}

      <RatingControl qdnName={APP_QDN_NAME} />

      <Tooltip title={isFollowed ? 'Stop following this app' : 'Follow this app'} placement="bottom">
        <IconButton
          size="small"
          onClick={() => void handleToggleFollow()}
          disabled={followBusy}
          sx={{
            borderRadius: `${tokens.shape.radius}px`,
            minWidth: 36, minHeight: 36,
            color: isFollowed ? c.accent : c.textSecondary,
            '&:hover': { color: c.accent, bgcolor: c.borderLight },
            transition: '0.15s ease',
          }}
        >
          {isFollowed ? <PersonRemoveAlt1Icon sx={{ fontSize: '1rem' }} /> : <PersonAddAlt1Icon sx={{ fontSize: '1rem' }} />}
        </IconButton>
      </Tooltip>

      <Tooltip title="Help & Feedback" placement="bottom">
        <IconButton
          size="small"
          onClick={handleOpenHelp}
          sx={{
            borderRadius: `${tokens.shape.radius}px`,
            minWidth: 36, minHeight: 36,
            color: c.textSecondary,
            '&:hover': { color: c.accent, bgcolor: c.borderLight },
            transition: '0.15s ease',
          }}
        >
          <HelpOutlineIcon sx={{ fontSize: '1rem' }} />
        </IconButton>
      </Tooltip>

      <Tooltip title={theme === EnumTheme.DARK ? 'Light mode' : 'Dark mode'} placement="bottom">
        <IconButton
          onClick={() => setTheme(t => t === EnumTheme.DARK ? EnumTheme.LIGHT : EnumTheme.DARK)}
          sx={{
            borderRadius: `${tokens.shape.radius}px`,
            minWidth: 36, minHeight: 36,
            color: c.textSecondary,
            '&:hover': { color: c.accent, bgcolor: c.borderLight },
            transition: '0.15s ease',
          }}
        >
          {theme === EnumTheme.DARK
            ? <LightModeIcon sx={{ fontSize: '1rem' }} />
            : <DarkModeIcon  sx={{ fontSize: '1rem' }} />}
        </IconButton>
      </Tooltip>
    </Box>
  );
}
