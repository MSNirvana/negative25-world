import { describe, expect, it } from 'vitest';
import { mergeFields } from './merge-fields.js';

describe('metadata precedence', () => {
  it('uses manual, manifest, EXIF, then defaults', () => {
    const result = mergeFields({
      defaults: { title: 'Untitled', rating: 0 },
      exif: { title: 'EXIF title', rating: 3, iso: 400 },
      manifest: { title: 'Manifest title', rating: 4 },
      manual: { title: 'Manual title' },
    });
    expect(result.fields).toEqual({ title: 'Manual title', rating: 4, iso: 400 });
    expect(result.sources.title).toBe('manual');
  });

  it('does not let empty manifest values erase EXIF, but supports explicit clear', () => {
    const preserved = mergeFields({ exif: { title: 'Keep me', rating: 4 }, manifest: { title: '' } });
    expect(preserved.fields.title).toBe('Keep me');
    expect(preserved.warnings).toContain('Manifest field title is empty and was ignored');
    const cleared = mergeFields({ exif: { title: 'Clear me' }, manifest: { title: { clear: true } } });
    expect(cleared.fields.title).toBeNull();
  });
});
