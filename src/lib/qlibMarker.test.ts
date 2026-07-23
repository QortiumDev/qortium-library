import { describe, it, expect } from 'vitest';
import {
  encodeDescription, decodeDescription, freeTextBudget,
  MarkerTooLargeError, MAX_DESCRIPTION_BYTES, MARKER_PREFIX,
  type QlibMarker,
} from './qlibMarker';

describe('encodeDescription / decodeDescription round-trip', () => {
  it('round-trips free text and a full marker', () => {
    const marker: QlibMarker = {
      title: 'Foundation', series: 'foundation', seriesTitle: 'Foundation',
      pos: 2, of: 7, genres: ['sci-fi', 'adventure'],
    };
    const encoded = encodeDescription('A classic of the genre.', marker);
    const { freeText, marker: decoded } = decodeDescription(encoded);
    expect(freeText).toBe('A classic of the genre.');
    expect(decoded).toEqual(marker);
  });

  it('round-trips with no free text at all', () => {
    const marker: QlibMarker = { title: 'Foundation' };
    const encoded = encodeDescription('', marker);
    const { freeText, marker: decoded } = decodeDescription(encoded);
    expect(freeText).toBe('');
    expect(decoded).toEqual(marker);
  });

  it('omits optional marker fields when not set', () => {
    const marker: QlibMarker = { title: 'Foundation' };
    const encoded = encodeDescription('desc', marker);
    expect(encoded).not.toContain('"series"');
    expect(encoded).not.toContain('"genres"');
  });
});

describe('decodeDescription graceful fallback', () => {
  it('returns the raw text with a null marker when there is no marker block', () => {
    const result = decodeDescription('Just a plain description, no marker.');
    expect(result.freeText).toBe('Just a plain description, no marker.');
    expect(result.marker).toBeNull();
  });

  it('returns a null marker (not a throw) for malformed JSON after the prefix', () => {
    const result = decodeDescription(`Some text\n\n${MARKER_PREFIX}{not valid json`);
    expect(result.marker).toBeNull();
  });

  it('does not leak the raw marker syntax into freeText when the JSON is malformed', () => {
    const result = decodeDescription(`Some text\n\n${MARKER_PREFIX}{not valid json`);
    expect(result.freeText).toBe('Some text');
  });

  it('returns a null marker when the parsed JSON has no title field', () => {
    const result = decodeDescription(`${MARKER_PREFIX}{"series":"foundation"}`);
    expect(result.marker).toBeNull();
  });

  it('does not leak the raw marker syntax into freeText when the JSON shape is invalid', () => {
    const result = decodeDescription(`Some text\n\n${MARKER_PREFIX}{"series":"foundation"}`);
    expect(result.freeText).toBe('Some text');
  });

  it('rejects a marker whose optional fields have the wrong type', () => {
    const result = decodeDescription(
      `${MARKER_PREFIX}{"title":"x","genres":"not-an-array","pos":"two"}`
    );
    expect(result.marker).toBeNull();
  });

  it('handles undefined input', () => {
    const result = decodeDescription(undefined);
    expect(result.freeText).toBe('');
    expect(result.marker).toBeNull();
  });
});

describe('freeTextBudget', () => {
  it('leaves most of the 240-byte budget free for a title-only marker', () => {
    const budget = freeTextBudget({ title: 'Foundation' });
    expect(budget).toBeGreaterThan(150);
    expect(budget).toBeLessThan(MAX_DESCRIPTION_BYTES);
  });

  it('shrinks as more marker fields are added', () => {
    const small = freeTextBudget({ title: 'Foundation' });
    const large = freeTextBudget({
      title: 'Foundation', series: 'foundation', seriesTitle: 'Foundation',
      pos: 2, of: 7, genres: ['sci-fi', 'adventure', 'dystopian', 'space-opera'],
    });
    expect(large).toBeLessThan(small);
  });
});

describe('encodeDescription overflow', () => {
  it('truncates free text that would overflow the description budget', () => {
    const longText = 'x'.repeat(300);
    const encoded = encodeDescription(longText, { title: 'Foundation' });
    expect(new TextEncoder().encode(encoded).length).toBeLessThanOrEqual(MAX_DESCRIPTION_BYTES);
    // The marker itself must never be truncated - it should still parse.
    const { marker } = decodeDescription(encoded);
    expect(marker?.title).toBe('Foundation');
  });

  it('throws MarkerTooLargeError when the marker alone cannot fit the budget', () => {
    const marker: QlibMarker = {
      title: 'x'.repeat(300), // absurdly long, on its own exceeds 240 bytes
    };
    expect(() => encodeDescription('', marker)).toThrow(MarkerTooLargeError);
  });

  it('does not throw for a marker-only payload just under the byte cap with no free text', () => {
    // Land the marker JSON's own byte size 1 byte under MAX_DESCRIPTION_BYTES.
    // freeTextBudget would report a *negative* budget here (it always reserves
    // room for the separator), but since freeText is empty no separator is
    // ever emitted, so this must still succeed.
    const overhead = new TextEncoder().encode(`${MARKER_PREFIX}${JSON.stringify({ title: '' })}`).length;
    const title = 'A'.repeat(MAX_DESCRIPTION_BYTES - overhead - 1);
    const marker: QlibMarker = { title };

    expect(() => encodeDescription('', marker)).not.toThrow();
    const encoded = encodeDescription('', marker);
    expect(new TextEncoder().encode(encoded).length).toBeLessThan(MAX_DESCRIPTION_BYTES);
    expect(decodeDescription(encoded).marker?.title).toBe(title);
  });
});
