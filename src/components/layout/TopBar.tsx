import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useAtomValue } from 'jotai';
import { Box, Chip, IconButton, Tooltip, Typography } from '@mui/material';
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1';
import PersonRemoveAlt1Icon from '@mui/icons-material/PersonRemoveAlt1';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { useNavigate, useLocation } from 'react-router-dom';
import { useColors } from '../../theme/ColorTokensContext';
import { tokens } from '../../theme/tokens';
import { accountAtom, uiStyleAtom } from '../../state/atoms';
import { RatingControl } from './RatingControl';
import { AppIcon, getOwnQdnName } from './AppIdentity';

const APP_QDN_NAME = getOwnQdnName('Library');
const APP_QDN_IDENTIFIER = 'Library';

export function TopBar() {
  const c = useColors();
  const account   = useAtomValue(accountAtom);
  const uiStyle   = useAtomValue(uiStyleAtom);
  const navigate  = useNavigate();
  const location  = useLocation();
  const headerRef = useRef<HTMLElement | null>(null);
  const [isFollowed, setIsFollowed] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const isClassic = uiStyle === 'classic';

  useLayoutEffect(() => {
    const header = headerRef.current;
    if (!header) return;

    const updateHeight = () => {
      document.documentElement.style.setProperty(
        '--library-top-bar-height',
        `${header.getBoundingClientRect().height}px`,
      );
    };

    updateHeight();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateHeight);
      return () => window.removeEventListener('resize', updateHeight);
    }

    const observer = new ResizeObserver(updateHeight);
    observer.observe(header);
    return () => observer.disconnect();
  }, [isClassic]);

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

  const buttonSx = {
    borderRadius: `${isClassic ? tokens.shape.radiusMd : tokens.shape.radius}px`,
    minWidth: 44,
    minHeight: 44,
    width: 44,
    height: 44,
    p: 0,
    color: c.textSecondary,
    '&:hover': { color: c.accent, bgcolor: isClassic ? c.controlHover : c.borderLight },
    transition: c.transitionControl,
  };

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
      ref={headerRef}
      sx={{
        position: 'fixed', top: 0, left: 0, right: 0,
        height: isClassic ? 'auto' : tokens.spacing.topBarHeight,
        minHeight: isClassic ? 'auto' : tokens.spacing.topBarHeight,
        bgcolor: c.surface,
        borderBottom: `${isClassic ? tokens.shape.classicBorderWidth : tokens.shape.borderWidth} solid ${isClassic ? c.border : c.borderLight}`,
        boxShadow: isClassic ? c.topBarShadow : 'none',
        display: 'flex', alignItems: 'center', flexWrap: 'wrap',
        px: isClassic ? { xs: 1.25, sm: 1.75 } : 2,
        py: isClassic ? 1 : 0,
        gap: 1, zIndex: 100,
      }}
    >
      <Box
        onClick={() => navigate('/')}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
          color: c.textPrimary,
          cursor: 'pointer',
          '&:hover': { color: c.accent },
          transition: c.transitionControl,
          userSelect: 'none',
          minWidth: 0,
        }}
      >
        <AppIcon qdnName={APP_QDN_NAME} />
        <Typography sx={{
          fontWeight: tokens.typography.weightBlack,
          fontSize: '1rem',
          color: 'inherit',
          letterSpacing: '-0.01em',
        }}>
          {APP_QDN_NAME}
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', gap: 0.75, mr: 'auto' }}>
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

      <RatingControl qdnName={APP_QDN_NAME} identifier={APP_QDN_IDENTIFIER} />

      <Tooltip title={isFollowed ? 'Stop following this app' : 'Follow this app'} placement="bottom">
        <IconButton
          size="small"
          onClick={() => void handleToggleFollow()}
          disabled={followBusy}
          sx={{ ...buttonSx, color: isFollowed ? c.accent : c.textSecondary }}
        >
          {isFollowed ? <PersonRemoveAlt1Icon fontSize="small" /> : <PersonAddAlt1Icon fontSize="small" />}
        </IconButton>
      </Tooltip>

      <Tooltip title="Help & Feedback" placement="bottom">
        <IconButton
          size="small"
          onClick={handleOpenHelp}
          sx={buttonSx}
        >
          <HelpOutlineIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );
}
