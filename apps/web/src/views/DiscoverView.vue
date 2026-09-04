<script setup lang="ts">
import { computed, onActivated, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { fetchDiscoverLocations, isApiConfigured } from '../api/client';
import DiscoverMap from '../components/DiscoverMap.vue';
import { normalizeLocations } from '../lib/discover-map-data';
import { useGalleryStore, type GalleryPhoto } from '../stores/gallery';
import type { DiscoverLocationRecord } from '@negative25/contracts';
import { useLocale } from '../i18n';
import { usePublicViewerStore } from '../stores/public-viewer';
import { photoReturnQuery } from '../lib/photo-return';

defineOptions({ name: 'DiscoverView' });

const route = useRoute();
const router = useRouter();
const gallery = useGalleryStore();
const publicViewer = usePublicViewerStore();
const locationRecords = ref<DiscoverLocationRecord[]>([]);
let locationRequest: AbortController | null = null;
let refreshSequence = 0;
const { t } = useLocale();

const discoverPhotoCatalog = computed<GalleryPhoto[]>(() => gallery.locationPhotos.length ? gallery.locationPhotos : gallery.photos);
const locations = computed(() => normalizeLocations(locationRecords.value.map((location) => ({ id: location.id, name: location.name, latitude: location.latitude, longitude: location.longitude, photoIds: location.photoIds })), discoverPhotoCatalog.value));
const unlocatedPhotos = computed(() => discoverPhotoCatalog.value.filter((photo) => !photo.coordinates));
function openPhoto(photo: GalleryPhoto): void {
  void router.push({ name: 'photo', params: { id: photo.id }, query: { ...route.query, ...photoReturnQuery(route.fullPath) } });
}

async function refreshDiscoverData(): Promise<void> {
  const requestId = ++refreshSequence;
  locationRequest?.abort();
  const controller = new AbortController();
  locationRequest = controller;

  const username = typeof route.query.user === 'string' ? route.query.user : null;
  const profile = await publicViewer.load(username);
  if (controller.signal.aborted || requestId !== refreshSequence) return;

  const nextSpaceSlug = profile?.workspaceSlug ?? 'primary';
  const spaceChanged = gallery.spaceSlug !== nextSpaceSlug;
  if (spaceChanged) {
    locationRecords.value = [];
  }
  gallery.setContext(nextSpaceSlug, null);
  void gallery.load('featured');
  void gallery.loadLocationCatalog(true);
  if (!isApiConfigured()) return;

  try {
    const records = await fetchDiscoverLocations(undefined, controller.signal, nextSpaceSlug);
    if (controller.signal.aborted || requestId !== refreshSequence || gallery.spaceSlug !== nextSpaceSlug) return;
    locationRecords.value = records;
  } catch {
    if (controller.signal.aborted || requestId !== refreshSequence) return;
    // Keep photo-derived locations visible when the optional location service fails.
  }
}

function handleVisibilityChange(): void {
  if (document.visibilityState === 'visible') void refreshDiscoverData();
}

onMounted(() => {
  document.addEventListener('visibilitychange', handleVisibilityChange);
  void refreshDiscoverData();
});
watch(() => route.query.user, () => { void refreshDiscoverData(); });
onActivated(() => { void refreshDiscoverData(); });
onBeforeUnmount(() => {
  refreshSequence += 1;
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  locationRequest?.abort();
});
</script>

<template>
  <main class="discover">
    <DiscoverMap :locations="locations" :unlocated-photos="unlocatedPhotos" @select-photo="openPhoto" />
  </main>
</template>

<style scoped>
.discover { min-height: 100svh; position: relative; }
</style>
