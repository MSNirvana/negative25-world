<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { fetchDiscoverLocations, isApiConfigured } from '../api/client';
import DiscoverMap from '../components/DiscoverMap.vue';
import DiscoverPlaceDetail from '../components/DiscoverPlaceDetail.vue';
import { normalizeLocations, type DiscoverLocation } from '../lib/discover-map-data';
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
const locationError = ref<string | null>(null);
const selectedId = ref<string | null>(null);
const selectedLocationOverride = ref<DiscoverLocation | null>(null);
const mobile = ref(false);
let mediaQuery: MediaQueryList | null = null;
let locationRequest: AbortController | null = null;
const { t } = useLocale();

const locations = computed(() => normalizeLocations(locationRecords.value.map((location) => ({ id: location.id, name: location.name, latitude: location.latitude, longitude: location.longitude, photoIds: location.photoIds })), gallery.photos));
const unlocatedPhotos = computed(() => gallery.photos.filter((photo) => !photo.coordinates));
const routeSlug = computed(() => typeof route.params.slug === 'string' ? route.params.slug : null);
const placeQuery = computed(() => typeof route.query.place === 'string' ? route.query.place : null);
const selectedLocation = computed<DiscoverLocation | null>(() => {
  if (!routeSlug.value && selectedLocationOverride.value && selectedLocationOverride.value.id === selectedId.value) return selectedLocationOverride.value;
  if (routeSlug.value) return locations.value.find((location) => location.slug === routeSlug.value) ?? null;
  return locations.value.find((location) => location.id === selectedId.value || location.slug === placeQuery.value) ?? null;
});
const mobilePlaceRoute = computed(() => mobile.value && Boolean(routeSlug.value));

function updateMobile(event?: MediaQueryListEvent): void { mobile.value = event ? event.matches : Boolean(mediaQuery?.matches); }
function selectLocation(location: DiscoverLocation): void {
  selectedId.value = location.id;
  selectedLocationOverride.value = location;
  if (mobile.value && locations.value.some((item) => item.id === location.id)) void router.push({ name: 'discover-place', params: { slug: location.slug }, query: route.query });
}
function clearLocation(): void {
  selectedId.value = null;
  selectedLocationOverride.value = null;
  if (routeSlug.value || placeQuery.value) {
    const query = { ...route.query, place: undefined };
    void router.replace({ name: 'discover', query });
  }
}
function openPhoto(photo: GalleryPhoto): void {
  const selectedIsRouteAddressable = selectedLocation.value && locations.value.some((location) => location.id === selectedLocation.value?.id);
  const returnPath = selectedIsRouteAddressable && !routeSlug.value
    ? router.resolve({ name: 'discover', query: { ...route.query, place: selectedLocation.value.slug } }).fullPath
    : route.fullPath;
  void router.push({ name: 'photo', params: { id: photo.id }, query: { ...route.query, ...photoReturnQuery(returnPath) } });
}
function backToMap(): void {
  selectedId.value = null;
  selectedLocationOverride.value = null;
  if (routeSlug.value || placeQuery.value) {
    const query = { ...route.query, place: undefined };
    void router.push({ name: 'discover', query });
  }
}

onMounted(async () => {
  updateMobile();
  mediaQuery = window.matchMedia('(max-width: 680px)');
  updateMobile();
  mediaQuery.addEventListener('change', updateMobile);
  const username = typeof route.query.user === 'string' ? route.query.user : null;
  const profile = username ? await publicViewer.load(username) : null;
  if (profile?.workspaceSlug) gallery.setContext(profile.workspaceSlug, null);
  void gallery.load('featured');
  if (!isApiConfigured()) return;
  locationRequest = new AbortController();
  void fetchDiscoverLocations(undefined, locationRequest.signal, gallery.spaceSlug).then((records) => { locationRecords.value = records; }).catch((cause: unknown) => {
    if (locationRequest?.signal.aborted) return;
    locationError.value = cause instanceof Error ? cause.message : t('discover.locationUnavailable');
  });
});
onBeforeUnmount(() => { mediaQuery?.removeEventListener('change', updateMobile); locationRequest?.abort(); });
</script>

<template>
  <main class="discover">
    <DiscoverMap v-if="!mobilePlaceRoute" :locations="locations" :unlocated-photos="unlocatedPhotos" :selected-id="selectedLocation?.id" :location-error="locationError" @select-location="selectLocation" @clear-location="clearLocation" @select-photo="openPhoto" />
    <DiscoverPlaceDetail v-if="selectedLocation" :location="selectedLocation" @back="backToMap" @open-photo="openPhoto" />
    <section v-else-if="routeSlug" class="discover-not-found" aria-live="polite">
      <span class="eyebrow">{{ t('discover.notFoundEyebrow') }}</span>
      <h1>{{ t('discover.notFoundTitle') }}</h1>
      <p>{{ t('discover.notFoundDescription') }}</p>
      <button type="button" @click="backToMap">{{ t('discover.notFoundBack') }}</button>
    </section>
  </main>
</template>

<style scoped>
.discover { min-height: 100svh; position: relative; }
.discover-not-found { align-items: flex-start; display: flex; flex-direction: column; gap: 12px; min-height: 100svh; padding: 170px 28px 80px; }
.discover-not-found h1 { font-family: Georgia, ui-serif, serif; font-size: clamp(38px, 6vw, 62px); font-weight: 500; letter-spacing: -.04em; margin: 0; }
.discover-not-found p { color: var(--muted); margin: 0; }
.discover-not-found button { background: var(--ink); border-radius: 4px; color: var(--paper); font-size: 12px; margin-top: 12px; padding: 10px 15px; }
@media (max-width: 680px) { .discover-not-found { padding: 145px 16px 60px; } }
</style>
