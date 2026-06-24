export enum EnumTheme {
  DARK = 'dark',
  LIGHT = 'light',
}

export type FileType = 'pdf' | 'epub' | 'txt' | 'cbz' | 'unknown';

export interface QdnResource {
  service: string;
  name: string;
  identifier: string;
  size?: number;
  status?: string;
  title?: string;
  description?: string;
  tags?: string[];
  category?: string;
  created?: number;
  updated?: number;
}

export interface BookmarkEntry {
  service: string;
  name: string;
  identifier: string;
  title?: string;
  filename?: string;
  savedAt: number;
}

export interface BookmarkStore {
  version: 1;
  bookmarks: BookmarkEntry[];
}

export function bookmarkKey(service: string, name: string, identifier: string): string {
  return `${service}::${name}::${identifier}`;
}

export function getFileType(identifier: string): FileType {
  const ext = identifier.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'pdf')  return 'pdf';
  if (ext === 'epub') return 'epub';
  if (ext === 'txt')  return 'txt';
  if (ext === 'cbz')  return 'cbz';
  return 'unknown';
}

export function formatBytes(bytes: number | undefined): string {
  if (!bytes) return '';
  if (bytes < 1024)            return `${bytes} B`;
  if (bytes < 1024 * 1024)     return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

export function formatDate(ts: number | undefined): string {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
