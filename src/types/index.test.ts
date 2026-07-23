import { describe, it, expect } from 'vitest';
import { getResourceTitle, type QdnResource } from './index';
import { encodeDescription } from '../lib/qlibMarker';

function baseResource(overrides: Partial<QdnResource> = {}): QdnResource {
  return { service: 'DOCUMENT', name: 'author', identifier: 'qlib-abc123.pdf', ...overrides };
}

describe('getResourceTitle', () => {
  it('prefers the marker title when a description marker is present', () => {
    const description = encodeDescription('blurb', {
      title: 'The Full Untruncated Title That Would Otherwise Get Cut',
    });
    const resource = baseResource({ title: 'Short label', description });
    expect(getResourceTitle(resource)).toBe('The Full Untruncated Title That Would Otherwise Get Cut');
  });

  it('reads the marker from metadata.description when top-level description is absent', () => {
    const description = encodeDescription('blurb', { title: 'Marker Title' });
    const resource = baseResource({ metadata: { description } });
    expect(getResourceTitle(resource)).toBe('Marker Title');
  });

  it('falls back to the plain title field when there is no marker', () => {
    const resource = baseResource({ title: 'Plain Title', description: 'just text, no marker' });
    expect(getResourceTitle(resource)).toBe('Plain Title');
  });

  it('falls back to the identifier when there is no title or marker at all', () => {
    const resource = baseResource({ identifier: 'qlib-xyz.pdf' });
    expect(getResourceTitle(resource)).toBe('qlib-xyz.pdf');
  });
});
