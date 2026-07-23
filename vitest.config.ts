import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Vitest doesn't respect .gitignore for test discovery, so a git
    // worktree checked out under .worktrees/ (see .gitignore) would
    // otherwise get its own copy of every *.test.ts file picked up
    // alongside the real ones, double-counting the suite.
    exclude: ['**/node_modules/**', '**/dist/**', '**/.git/**', '**/.worktrees/**'],
  },
});
