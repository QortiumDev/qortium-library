import type { QdnResource, BookmarkStore } from '../types';

export async function getUserAccount(): Promise<{ address: string; name: string | null }> {
  const res = await qdnRequest({ action: 'GET_SELECTED_ACCOUNT' }) as { address: string; name: string | null };
  return { address: res.address, name: res.name || null };
}

export async function searchResources(opts: {
  service?: string;
  query?: string;
  keywords?: string[];
  identifier?: string;
  prefixOnly?: boolean;
  limit?: number;
  offset?: number;
}): Promise<QdnResource[]> {
  try {
    const res = await qdnRequest({
      action: 'SEARCH_QDN_RESOURCES',
      // 'LATEST' collapses results to one row per (name, service) pair on the
      // node side, discarding every other identifier a publisher has under that
      // service - so an account with several books would show only its newest.
      // 'ALL' returns one row per distinct (name, service, identifier), i.e.
      // one row per book, which is what a document library needs.
      mode: 'ALL',
      includeMetadata: true,
      limit:  opts.limit  ?? 20,
      offset: opts.offset ?? 0,
      reverse: true,
      ...(opts.service    ? { service: opts.service }     : {}),
      ...(opts.query      ? { query: opts.query }         : {}),
      ...(opts.keywords   ? { keywords: opts.keywords }   : {}),
      ...(opts.identifier ? { identifier: opts.identifier } : {}),
      ...(opts.prefixOnly ? { prefix: opts.prefixOnly }     : {}),
    }) as QdnResource[];
    return res ?? [];
  } catch { return []; }
}

export async function listResources(
  name: string,
  service?: string,
  offset = 0,
  limit  = 50,
): Promise<QdnResource[]> {
  try {
    const res = await qdnRequest({
      action: 'LIST_QDN_RESOURCES',
      name,
      includeMetadata: true,
      limit,
      offset,
      reverse: true,
      ...(service ? { service } : {}),
    }) as QdnResource[];
    return res ?? [];
  } catch { return []; }
}

export async function getResource(
  service: string,
  name: string,
  identifier: string,
): Promise<QdnResource | null> {
  try {
    const res = await qdnRequest({
      action: 'LIST_QDN_RESOURCES',
      service,
      name,
      identifier,
      includeMetadata: true,
      limit: 1,
    }) as QdnResource[];
    return res?.[0] ?? null;
  } catch { return null; }
}

export async function fetchResourceAsBase64(
  service: string,
  name: string,
  identifier: string,
): Promise<string> {
  const res = await qdnRequest({
    action: 'FETCH_QDN_RESOURCE',
    service,
    name,
    identifier,
    encoding: 'BASE64',
  }) as string;
  return res;
}

export async function fetchResourceText(
  service: string,
  name: string,
  identifier: string,
): Promise<string> {
  const b64 = await fetchResourceAsBase64(service, name, identifier);
  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export async function publishJsonResource(opts: {
  name: string;
  identifier: string;
  data: unknown;
}): Promise<void> {
  const json = JSON.stringify(opts.data);
  const data64 = btoa(unescape(encodeURIComponent(json)));
  await qdnRequest({
    action: 'PUBLISH_QDN_RESOURCE',
    service: 'JSON',
    name: opts.name,
    identifier: opts.identifier,
    data64,
    filename: `${opts.identifier}.json`,
  });
}

export async function fetchBookmarks(name: string): Promise<BookmarkStore | null> {
  try {
    const text = await fetchResourceText('JSON', name, 'qlib-bookmarks');
    return JSON.parse(text) as BookmarkStore;
  } catch { return null; }
}

export async function saveBookmarks(name: string, store: BookmarkStore): Promise<void> {
  await publishJsonResource({ name, identifier: 'qlib-bookmarks', data: store });
}

export async function saveQdnResource(
  service: string,
  name: string,
  identifier: string,
  filename: string,
): Promise<{ canceled: boolean }> {
  return await qdnRequest({
    action: 'SAVE_QDN_RESOURCE',
    service,
    name,
    identifier,
    filename,
  }) as { canceled: boolean };
}

export async function openDocumentViewer(
  service: string,
  name: string,
  identifier: string | null,
  path?: string | null,
  filename?: string | null,
): Promise<boolean> {
  return await qdnRequest({
    action: 'OPEN_QDN_DOCUMENT_VIEWER',
    service,
    name,
    identifier: identifier ?? null,
    path: path ?? null,
    // Format hint for Home's document viewer - single-file resources have no
    // path, so without this epub/pdf/cbz detection falls back to the node's
    // unreliable Content-Type header. Ignored by Home builds that predate
    // QortiumDev/qortium-home#142.
    filename: filename ?? null,
  }) as boolean;
}


export function buildQdnUrl(service: string, name: string, identifier: string): string {
  const id = identifier && identifier !== 'default' ? `/${identifier}` : '';
  return `qdn://${service}/${name}${id}`;
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => { resolve((reader.result as string).split(',')[1] ?? ''); };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export interface PublishableResource {
  service:      string;
  name:         string;
  identifier:   string;
  data64:       string;
  filename:     string;
  title?:       string;
  description?: string;
  tags?:        string[];
}

export async function publishMultipleResources(resources: PublishableResource[]): Promise<void> {
  await qdnRequest({ action: 'PUBLISH_MULTIPLE_QDN_RESOURCES', resources });
}

export async function ensureAccountUnlocked(): Promise<boolean> {
  const result = await qdnRequest({ action: 'UNLOCK_SELECTED_ACCOUNT' }) as { isUnlocked?: boolean } | null;
  return result?.isUnlocked === true;
}
