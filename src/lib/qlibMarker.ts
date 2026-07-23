import { utf8Length, truncateToUtf8Bytes } from './bytes';

// Sentinel that separates the author's free-text description from the
// machine-managed JSON block. Never shown to or editable by the publisher
// directly - PublishPage only ever lets them edit the free-text portion and
// pick genre/series through structured controls; this module owns the
// serialization.
export const MARKER_PREFIX = '::qlib::';

// Matches ArbitraryDataTransactionMetadata.MAX_DESCRIPTION_LENGTH in Qortium
// Core - description is silently trimmed past this many UTF-8 bytes.
export const MAX_DESCRIPTION_BYTES = 240;

const SEPARATOR = '\n\n';

export interface QlibMarker {
  title:        string;
  series?:      string;
  seriesTitle?: string;
  pos?:         number;
  of?:          number;
  genres?:      string[];
}

export class MarkerTooLargeError extends Error {}

function markerJson(marker: QlibMarker): string {
  return MARKER_PREFIX + JSON.stringify(marker);
}

// How many bytes are left for the author's free text once the marker (which
// varies in size depending on how much series/genre data is attached) is
// accounted for. Exported so the publish form can show a live byte counter
// that reflects the *current* marker, not a flat assumption.
export function freeTextBudget(marker: QlibMarker): number {
  return MAX_DESCRIPTION_BYTES - utf8Length(markerJson(marker)) - utf8Length(SEPARATOR);
}

export function encodeDescription(freeText: string, marker: QlibMarker): string {
  const json = markerJson(marker);
  // Check the marker's own size against the cap directly - freeTextBudget
  // always reserves bytes for the separator, but the separator is only
  // emitted when there's actual free text, so a marker-only payload that's
  // just under MAX_DESCRIPTION_BYTES must not be spuriously rejected.
  if (utf8Length(json) > MAX_DESCRIPTION_BYTES) {
    throw new MarkerTooLargeError(
      `Title/series/genre info doesn't fit in the ${MAX_DESCRIPTION_BYTES}-byte description budget - ` +
      `try a shorter title or series name.`
    );
  }
  const budget = freeTextBudget(marker);
  const trimmed = truncateToUtf8Bytes(freeText, budget);
  return trimmed ? `${trimmed}${SEPARATOR}${json}` : json;
}

function isQlibMarker(value: unknown): value is QlibMarker {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.title !== 'string') return false;
  if (v.series !== undefined && typeof v.series !== 'string') return false;
  if (v.seriesTitle !== undefined && typeof v.seriesTitle !== 'string') return false;
  if (v.pos !== undefined && typeof v.pos !== 'number') return false;
  if (v.of !== undefined && typeof v.of !== 'number') return false;
  if (v.genres !== undefined) {
    if (!Array.isArray(v.genres) || !v.genres.every((g) => typeof g === 'string')) return false;
  }
  return true;
}

export function decodeDescription(raw: string | undefined): { freeText: string; marker: QlibMarker | null } {
  if (!raw) return { freeText: '', marker: null };

  const idx = raw.indexOf(MARKER_PREFIX);
  if (idx === -1) return { freeText: raw, marker: null };

  const freeText = raw.slice(0, idx).trimEnd();
  const jsonPart = raw.slice(idx + MARKER_PREFIX.length);

  try {
    const parsed: unknown = JSON.parse(jsonPart);
    if (!isQlibMarker(parsed)) return { freeText, marker: null };
    return { freeText, marker: parsed };
  } catch {
    return { freeText, marker: null };
  }
}
