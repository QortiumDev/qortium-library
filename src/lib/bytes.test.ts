import { describe, it, expect } from 'vitest';
import { utf8Length, truncateToUtf8Bytes, toSafeTitle } from './bytes';

describe('utf8Length', () => {
  it('counts plain ASCII as 1 byte per char', () => {
    expect(utf8Length('hello')).toBe(5);
  });

  it('counts multi-byte characters correctly', () => {
    // é is 2 bytes in UTF-8
    expect(utf8Length('café')).toBe(5);
  });
});

describe('truncateToUtf8Bytes', () => {
  it('returns the string unchanged when under budget', () => {
    expect(truncateToUtf8Bytes('hello', 10)).toBe('hello');
  });

  it('truncates ASCII to the exact byte budget', () => {
    expect(truncateToUtf8Bytes('hello world', 5)).toBe('hello');
  });

  it('never splits a multi-byte character in half', () => {
    // 'café' is 5 bytes (c-a-f-é where é=2 bytes); budget of 4 must drop
    // the whole é, not emit a broken half-character.
    const result = truncateToUtf8Bytes('café', 4);
    expect(result).toBe('caf');
    expect(utf8Length(result)).toBeLessThanOrEqual(4);
  });

  it('returns empty string for a zero or negative budget', () => {
    expect(truncateToUtf8Bytes('hello', 0)).toBe('');
    expect(truncateToUtf8Bytes('hello', -5)).toBe('');
  });

  it('never splits an astral-plane character (surrogate pair) in half', () => {
    // 😀 (U+1F600) is a 4-byte UTF-8 character represented in JS as a
    // UTF-16 surrogate pair. 'A😀' is 1 + 4 = 5 bytes. A budget of 4 must
    // drop the whole emoji, not leave a lone unpaired surrogate behind.
    const result = truncateToUtf8Bytes('A😀', 4);
    // Detect an unpaired (lone) high or low surrogate directly. This has
    // real teeth, unlike a round-trip-through-Array.from check: JS treats
    // a lone surrogate as its own iteration unit, so that check passes
    // even on broken output.
    const hasLoneSurrogate =
      /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(
        result,
      );
    expect(hasLoneSurrogate).toBe(false);
    expect(utf8Length(result)).toBeLessThanOrEqual(4);
  });
});

describe('toSafeTitle', () => {
  it('returns short titles unchanged', () => {
    expect(toSafeTitle('Foundation')).toBe('Foundation');
  });

  it('truncates titles over 80 bytes and appends an ellipsis', () => {
    const longTitle = 'A'.repeat(100);
    const result = toSafeTitle(longTitle);
    expect(utf8Length(result)).toBeLessThanOrEqual(80);
    expect(result.endsWith('…')).toBe(true);
  });

  it('keeps the result at or under the 80-byte cap even with multi-byte chars', () => {
    const longTitle = 'é'.repeat(60); // 120 bytes raw
    const result = toSafeTitle(longTitle);
    expect(utf8Length(result)).toBeLessThanOrEqual(80);
  });
});
