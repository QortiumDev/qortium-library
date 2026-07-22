import { truncateToUtf8Bytes } from './bytes';

// QDN only overwrites a resource when (service, name, identifier) matches
// exactly. A deterministic identifier - same filename in, same identifier
// out - means republishing the same book overwrites it instead of creating
// a duplicate. The "qlib-" prefix doubles as a discovery marker: Browse can
// find every book this app published with a single identifier-prefix search
// instead of scanning the whole DOCUMENT service or relying on a tag.
const QLIB_PREFIX = 'qlib-';
const HASH_HEX_CHARS = 12; // 48 bits - collisions only matter within one publisher's own catalog

// Caps the extension so the 64-byte identifier bound holds unconditionally,
// even for a caller that passes an unusually long or unexpected extension -
// not just for the app's current 4 accepted formats (.pdf/.epub/.txt/.cbz).
// 5-byte prefix + 12-byte hash + 20-byte extension cap = 37 bytes max.
const EXTENSION_MAX_BYTES = 20;

export function fileExtension(filename: string): string {
  const dot = filename.lastIndexOf('.');
  if (dot <= 0) return '';
  return truncateToUtf8Bytes(filename.slice(dot).toLowerCase(), EXTENSION_MAX_BYTES);
}

export async function hashFilename(filename: string): Promise<string> {
  const bytes = new TextEncoder().encode(filename.toLowerCase());
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hex = Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return hex.slice(0, HASH_HEX_CHARS);
}

export async function toIdentifier(filename: string): Promise<string> {
  const hash = await hashFilename(filename);
  return `${QLIB_PREFIX}${hash}${fileExtension(filename)}`;
}
