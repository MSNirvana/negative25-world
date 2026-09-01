import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useDiscoverCircleSelectionStore } from './discover-circle-selection.js';
import type { GalleryPhoto } from './gallery.js';

function photo(id: string): GalleryPhoto {
  return { id, title: id, caption: '', capturedAt: '', location: '', aspectRatio: 1, image: '', fullImage: '', tone: '', camera: '', lens: '', focalLength: '', aperture: '', shutterSpeed: '', iso: '', rating: null };
}

describe('discover circle selection store', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('keeps the selected thumbnails until the user clears the circle', () => {
    const selection = useDiscoverCircleSelectionStore();
    selection.select([photo('one')]);
    expect(selection.active).toBe(true);
    expect(selection.photos.map((item) => item.id)).toEqual(['one']);
    selection.clear();
    expect(selection.active).toBe(false);
    expect(selection.photos).toEqual([]);
  });
});
