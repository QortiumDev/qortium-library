import { Box } from '@mui/material';
import type { QdnResource } from '../../types';
import { BookCard } from './BookCard';

export function BookGrid({ resources }: { resources: QdnResource[] }) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: 'repeat(2, 1fr)',
          sm: 'repeat(3, 1fr)',
          md: 'repeat(4, 1fr)',
          lg: 'repeat(5, 1fr)',
        },
        gap: { xs: 1.5, md: 2 },
      }}
    >
      {resources.map(r => (
        <BookCard
          key={`${r.service}::${r.name}::${r.identifier}`}
          resource={r}
        />
      ))}
    </Box>
  );
}
