import { decodeDescription } from '../lib/qlibMarker';

export enum EnumTheme {
  DARK = 'dark',
  LIGHT = 'light',
}

export type FileType = 'pdf' | 'epub' | 'txt' | 'cbz' | 'unknown';

export interface QdnResourceMetadata {
  title?: string;
  description?: string;
  tags?: string[];
  category?: string;
  mimeType?: string;
}

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
  metadata?: QdnResourceMetadata;
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

function getFileTypeFromMime(mimeType: string): FileType {
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType === 'application/epub+zip') return 'epub';
  if (mimeType.startsWith('text/plain')) return 'txt';
  if (mimeType === 'application/vnd.comicbook+zip' || mimeType === 'application/x-cbz') return 'cbz';
  return 'unknown';
}

// `identifier` is a publisher-chosen string, not a filename - it's only
// extension-shaped for books this app itself published. `metadata.mimeType`
// is computed node-side from the actual file content, so it's reliable
// regardless of what published the resource; identifier parsing is only a
// fallback for older resources published without metadata.
export function getResourceFileType(resource: QdnResource): FileType {
  const mimeType = resource.metadata?.mimeType;
  if (mimeType) {
    const fromMime = getFileTypeFromMime(mimeType);
    if (fromMime !== 'unknown') return fromMime;
  }
  return getFileType(resource.identifier);
}

export function getResourceTitle(resource: QdnResource): string {
  const { marker } = decodeDescription(resource.metadata?.description || resource.description);
  if (marker?.title) return marker.title;
  return resource.metadata?.title || resource.title || resource.identifier;
}

export function getResourceDescription(resource: QdnResource): string | undefined {
  return resource.metadata?.description || resource.description;
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
