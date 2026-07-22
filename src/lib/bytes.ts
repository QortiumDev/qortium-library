export function utf8Length(s: string): number {
  return new TextEncoder().encode(s).length;
}

// Truncates by dropping whole characters from the end until the UTF-8 byte
// length fits the budget, so a multi-byte character is never split in half.
// Iterates over Unicode code points (via Array.from), not raw UTF-16 code
// units, so astral-plane characters (e.g. emoji) represented as surrogate
// pairs are dropped whole rather than leaving a lone surrogate behind.
export function truncateToUtf8Bytes(s: string, maxBytes: number): string {
  if (maxBytes <= 0) return '';
  const chars = Array.from(s);
  while (utf8Length(chars.join('')) > maxBytes) chars.pop();
  return chars.join('');
}

// Qortium Core silently trims the `title` metadata field past this many
// UTF-8 bytes (ArbitraryDataTransactionMetadata.MAX_TITLE_LENGTH). We trim
// ourselves first so the app controls where the cut happens and can signal
// it clearly, instead of Core doing it invisibly.
const TITLE_MAX_BYTES = 80;
const ELLIPSIS = '…';

export function toSafeTitle(title: string): string {
  if (utf8Length(title) <= TITLE_MAX_BYTES) return title;
  const budget = TITLE_MAX_BYTES - utf8Length(ELLIPSIS);
  return truncateToUtf8Bytes(title, budget) + ELLIPSIS;
}
