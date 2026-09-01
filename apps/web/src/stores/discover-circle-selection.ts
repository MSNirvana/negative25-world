import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import type { GalleryPhoto } from './gallery';

/** Keeps one Discover circle result alive while the viewer route is open. */
export const useDiscoverCircleSelectionStore = defineStore('discover-circle-selection', () => {
  const selected = ref(false);
  const photos = ref<GalleryPhoto[]>([]);
  const active = computed(() => selected.value);

  function select(nextPhotos: readonly GalleryPhoto[]): void {
    selected.value = true;
    photos.value = [...nextPhotos];
  }

  function clear(): void {
    selected.value = false;
    photos.value = [];
  }

  return { active, photos, select, clear };
});
