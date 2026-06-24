import type { ComponentType, ReactNode } from 'react';
import { Box, Typography } from '@mui/material';
import type { SvgIconProps } from '@mui/material';
import { useColors } from '../../theme/ColorTokensContext';
import { tokens } from '../../theme/tokens';

export function EmptyState({
  Icon,
  title,
  subtitle,
  action,
}: {
  Icon: ComponentType<SvgIconProps>;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  const c = useColors();
  return (
    <Box sx={{ py: 8, textAlign: 'center', px: 3 }}>
      <Icon sx={{ fontSize: '2.5rem', color: c.textSecondary, opacity: 0.25, mb: 1.5 }} />
      <Typography sx={{ fontSize: '0.9rem', fontWeight: tokens.typography.weightBold, color: c.textSecondary, mb: 0.5 }}>
        {title}
      </Typography>
      {subtitle && (
        <Typography sx={{ fontSize: '0.75rem', color: c.textSecondary, opacity: 0.7 }}>
          {subtitle}
        </Typography>
      )}
      {action && <Box sx={{ mt: 2 }}>{action}</Box>}
    </Box>
  );
}
