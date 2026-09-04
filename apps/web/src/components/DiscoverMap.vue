<script setup lang="ts">
import { computed, nextTick, onActivated, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { load as loadAMap } from '@amap/amap-jsapi-loader';
import { LocateFixed, Minus, Plus } from 'lucide-vue-next';
import DiscoverCircleResults from './DiscoverCircleResults.vue';
import DiscoverPlacePanel from './DiscoverPlacePanel.vue';
import type { GalleryPhoto } from '../stores/gallery';
import { groupForAddressParts, groupPhotosByRegion, photosInCircle, toAMapCoordinates, type ContainerPoint, type DiscoverLocation } from '../lib/discover-map-data';
import { useLocale } from '../i18n';
import { mapStyleForTheme, useTheme } from '../theme';
import { useDiscoverCircleSelectionStore } from '../stores/discover-circle-selection';

type AMapPoint = { lnglat: [number, number]; extData: { location: DiscoverLocation } };
type ClusterContext = { marker: AMap.Marker; count: number };
type MarkerContext = { marker: AMap.Marker };
type MarkerClusterInstance = { setMap: (map: AMap.Map | null) => void };
type MapInteractionEvent = { pixel?: AMap.Pixel; lnglat?: AMap.LngLat; target?: unknown };
type AMapGeocoder = { getAddress: (location: AMap.LocationValue, callback: (status: string, result: unknown) => void) => void };
type AMapRuntime = typeof AMap & {
  Geocoder?: new (options?: Record<string, unknown>) => AMapGeocoder;
  MarkerCluster: new (map: AMap.Map, points: AMapPoint[], options: {
    gridSize: number;
    renderClusterMarker: (context: ClusterContext) => void;
    renderMarker: (context: MarkerContext) => void;
  }) => MarkerClusterInstance;
};

const props = defineProps<{
  locations: DiscoverLocation[];
  unlocatedPhotos: GalleryPhoto[];
}>();

const emit = defineEmits<{
  (event: 'select-photo', photo: GalleryPhoto): void;
  (event: 'clear-location'): void;
}>();

const { locale, t } = useLocale();
const { theme } = useTheme();
const circleSelection = useDiscoverCircleSelectionStore();
const mapContainer = ref<HTMLElement | null>(null);
const map = shallowRef<AMap.Map | null>(null);
const amap = shallowRef<AMapRuntime | null>(null);
const geocoder = shallowRef<AMapGeocoder | null>(null);
const cluster = shallowRef<MarkerClusterInstance | null>(null);
const mapReady = ref(false);
const mapLoading = ref(true);
const mapError = ref<string | null>(null);
const circlePoint = ref<ContainerPoint>({ x: 0, y: 0 });
const circleVisible = ref(false);
const circleLocked = ref(circleSelection.active);
const circlePhotos = ref<GalleryPhoto[]>([...circleSelection.photos]);
const resolvedAddresses = ref(new Map<string, { province?: string; country?: string }>());
const pointerCircleEnabled = ref(false);
// Keep the selection circle compact while preserving a fixed screen-space size.
const circleRadius = 54;
let pointerMedia: MediaQueryList | null = null;
let suppressMapClickUntil = 0;
// AMap zoom 2 shows the full world; start one step closer for a 200% default view.
const zoom = ref(4);
const initialCenter: [number, number] = [104, 35];
const initialZoom = 4;
const baseZoom = 2;
const amapKey = import.meta.env.VITE_AMAP_KEY?.trim();
const securityCode = import.meta.env.VITE_AMAP_SECURITY_CODE?.trim();
const zoomLabel = computed(() => `${Math.round((zoom.value / baseZoom) * 100)}%`);
const circleSelectionActive = computed(() => circleLocked.value);
const circleSections = computed(() => {
  const resolved = new Map([...resolvedAddresses.value].map(([id, address]) => [id, groupForAddressParts(address.province, address.country, locale.value)]));
  return groupPhotosByRegion(circlePhotos.value, locale.value, resolved);
});

function updateZoom(): void {
  if (map.value) zoom.value = map.value.getZoom();
}

function containerPointFromEvent(event: MapInteractionEvent): ContainerPoint | undefined {
  const pixel = event.pixel ?? (event.lnglat && map.value?.lngLatToContainer(event.lnglat));
  if (!pixel) return undefined;
  return { x: pixel.getX(), y: pixel.getY() };
}

function selectPhotosInCircle(): void {
  const currentMap = map.value;
  if (!currentMap) return;
  circlePhotos.value = photosInCircle(props.locations, (location) => {
    const position = toAMapCoordinates(location.coordinates);
    const pixel = currentMap.lngLatToContainer(position);
    return { x: pixel.getX(), y: pixel.getY() };
  }, circlePoint.value, circleRadius);
  circleSelection.select(circlePhotos.value);
  void resolveCircleRegions(circlePhotos.value);
}

function updateResolvedAddress(photoId: string, address: { province?: string; country?: string }): void {
  resolvedAddresses.value = new Map(resolvedAddresses.value).set(photoId, address);
}

function textValue(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function addressParts(result: unknown): { province?: string; country?: string } {
  if (!result || typeof result !== 'object') return {};
  const root = result as { regeocode?: { addressComponent?: Record<string, unknown> } };
  const component = root.regeocode?.addressComponent;
  if (!component) return {};
  return { province: textValue(component.province), country: textValue(component.country) || textValue(component.countryCode) };
}

async function resolveCircleRegions(photos: readonly GalleryPhoto[]): Promise<void> {
  const currentGeocoder = geocoder.value;
  if (!currentGeocoder) return;
  for (const photo of photos) {
    if (!photo.coordinates || resolvedAddresses.value.has(photo.id)) continue;
    await new Promise<void>((resolve) => {
      const position = toAMapCoordinates(photo.coordinates!);
      currentGeocoder.getAddress(position, (status, result) => {
        updateResolvedAddress(photo.id, status === 'complete' ? addressParts(result) : {});
        resolve();
      });
    });
  }
}

function clearCircleSelection(): void {
  circleLocked.value = false;
  circleVisible.value = false;
  circlePhotos.value = [];
  circleSelection.clear();
}

function mapPointerMove(event: MapInteractionEvent): void {
  if (!pointerCircleEnabled.value) return;
  const point = containerPointFromEvent(event);
  if (!point) return;
  circlePoint.value = point;
  circleVisible.value = true;
}

function mapPointerOut(): void {
  circleVisible.value = false;
}

function mapClick(event: MapInteractionEvent): void {
  if (!pointerCircleEnabled.value || Date.now() < suppressMapClickUntil) return;
  const currentMap = map.value;
  if (!currentMap || (event.target && event.target !== currentMap)) return;
  const point = containerPointFromEvent(event);
  if (!point) return;
  circlePoint.value = point;
  circleLocked.value = true;
  circleVisible.value = true;
  selectPhotosInCircle();
  emit('clear-location');
}

function selectCircleAtMarker(marker: AMap.Marker): void {
  const point = containerPointFromEvent({ lnglat: marker.getPosition() });
  if (!point) return;
  circlePoint.value = point;
  circleLocked.value = true;
  circleVisible.value = true;
  selectPhotosInCircle();
  emit('clear-location');
}

function handleEscape(event: KeyboardEvent): void {
  if (event.key !== 'Escape' || !circleLocked.value) return;
  clearCircleSelection();
  emit('clear-location');
}

function updatePointerCapability(event: MediaQueryListEvent): void {
  pointerCircleEnabled.value = event.matches;
  if (!event.matches) clearCircleSelection();
}

function renderClusters(): void {
  const currentMap = map.value;
  const currentAMap = amap.value;
  if (!currentMap || !currentAMap || !mapReady.value) return;
  cluster.value?.setMap(null);
  cluster.value = null;
  if (!props.locations.length) return;

  const points: AMapPoint[] = props.locations.map((location) => ({ lnglat: toAMapCoordinates(location.coordinates), extData: { location } }));
  cluster.value = new currentAMap.MarkerCluster(currentMap, points, {
    gridSize: 58,
    renderClusterMarker: (context) => {
      const size = Math.min(40, 22 + Math.round(Math.log10(Math.max(1, context.count)) * 8));
      const content = document.createElement('div');
      content.className = 'amap-cluster-marker';
      content.setAttribute('role', 'button');
      content.setAttribute('tabindex', '0');
      content.setAttribute('aria-label', t('discover.clusterCount', { count: context.count }));
      content.textContent = String(context.count);
      content.style.width = `${size}px`;
      content.style.height = `${size}px`;
      content.style.lineHeight = `${size}px`;
      const selectClusterCircle = (event: Event) => {
        event.stopPropagation();
        suppressMapClickUntil = Date.now() + 80;
        selectCircleAtMarker(context.marker);
      };
      content.addEventListener('click', (event) => {
        selectClusterCircle(event);
      });
      content.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        selectClusterCircle(event);
      });
      context.marker.setContent(content);
      context.marker.setOffset(new currentAMap.Pixel(-size / 2, -size / 2));
    },
    renderMarker: (context) => {
      // Single locations stay on the map data set for circle selection, but have no visible marker.
      const content = document.createElement('span');
      content.setAttribute('aria-hidden', 'true');
      content.style.display = 'none';
      content.style.pointerEvents = 'none';
      context.marker.setContent(content);
    },
  });
}

function setZoom(next: number): void {
  if (!map.value) return;
  map.value.setZoom(Math.min(18, Math.max(2, next)));
}

function resetView(): void {
  clearCircleSelection();
  map.value?.setZoomAndCenter(initialZoom, initialCenter);
  emit('clear-location');
}

function applyMapTheme(): void {
  map.value?.setMapStyle(mapStyleForTheme(theme.value));
}

function resizeRetainedMap(): void {
  void nextTick(() => {
    const retainedMap = map.value as (AMap.Map & { resize?: () => void }) | null;
    retainedMap?.resize?.();
  });
}

async function initMap(): Promise<void> {
  if (!amapKey) {
    mapLoading.value = false;
    mapError.value = t('discover.amapMissing');
    return;
  }
  if (securityCode) window._AMapSecurityConfig = { securityJsCode: securityCode };
  try {
    const runtime = await loadAMap({ key: amapKey, version: '2.0', plugins: ['AMap.MarkerCluster', 'AMap.Geocoder'] }) as AMapRuntime;
    if (!mapContainer.value) return;
    amap.value = runtime;
    geocoder.value = runtime.Geocoder ? new runtime.Geocoder({ radius: 1000, extensions: 'all' }) : null;
    const instance = new runtime.Map(mapContainer.value, {
      center: initialCenter,
      zoom: initialZoom,
      showOversea: true,
      mapStyle: mapStyleForTheme(theme.value),
      resizeEnable: true,
      dragEnable: true,
      zoomEnable: true,
      scrollWheel: true,
      touchZoom: true,
      keyboardEnable: true,
      rotateEnable: false,
      pitchEnable: false,
    } as AMap.Map.Options & { showOversea: boolean });
    map.value = instance;
    instance.setDefaultCursor('crosshair');
    instance.on('zoomend', updateZoom);
    instance.on('mousemove', mapPointerMove);
    instance.on('mouseout', mapPointerOut);
    instance.on('click', mapClick);
    instance.on('complete', () => {
      mapReady.value = true;
      mapLoading.value = false;
      updateZoom();
      renderClusters();
    });
    mapReady.value = true;
    mapLoading.value = false;
    updateZoom();
    renderClusters();
  } catch (cause: unknown) {
    mapLoading.value = false;
    mapError.value = cause instanceof Error ? cause.message : t('discover.amapError');
  }
}

// Keep a locked circle result stable while the gallery/location catalog is
// refreshing. A transient empty catalog must not erase the user's selection;
// only an explicit new selection or clear action may replace it.
watch(() => props.locations, () => { renderClusters(); }, { deep: true });
watch(theme, applyMapTheme);
onActivated(resizeRetainedMap);
onMounted(() => {
  pointerMedia = window.matchMedia('(hover: hover) and (pointer: fine)');
  pointerCircleEnabled.value = pointerMedia.matches;
  pointerMedia.addEventListener('change', updatePointerCapability);
  window.addEventListener('keydown', handleEscape);
  void initMap();
});
onBeforeUnmount(() => {
  cluster.value?.setMap(null);
  cluster.value = null;
  map.value?.destroy();
  map.value = null;
  geocoder.value = null;
  pointerMedia?.removeEventListener('change', updatePointerCapability);
  window.removeEventListener('keydown', handleEscape);
});
</script>

<template>
  <section class="discover-map" :aria-label="t('discover.placesMap')">
    <div class="map-shell">
      <div ref="mapContainer" class="amap-container" role="application" :aria-label="t('discover.mapLabel')" :aria-busy="mapLoading" />
      <div v-if="circleVisible" class="circle-overlay" :class="{ locked: circleLocked }" :style="{ left: `${circlePoint.x - circleRadius}px`, top: `${circlePoint.y - circleRadius}px`, width: `${circleRadius * 2}px`, height: `${circleRadius * 2}px` }" aria-hidden="true" />
      <div v-if="mapLoading" class="map-status" role="status">{{ t('discover.amapLoading') }}</div>
      <div v-else-if="mapError" class="map-status map-status-error" role="status">{{ mapError }}</div>
      <div class="map-controls" :aria-label="t('discover.controls')">
        <button class="map-control" type="button" :aria-label="t('discover.zoomIn')" :title="t('discover.zoomIn')" @click="setZoom(zoom + 1)"><Plus :size="18" /></button>
        <span class="zoom-readout" aria-live="polite">{{ zoomLabel }}</span>
        <button class="map-control" type="button" :aria-label="t('discover.zoomOut')" :title="t('discover.zoomOut')" @click="setZoom(zoom - 1)"><Minus :size="18" /></button>
        <button class="map-control reset-control" type="button" :aria-label="t('discover.reset')" :title="t('discover.reset')" @click="resetView"><LocateFixed :size="16" /></button>
      </div>
    </div>
    <DiscoverCircleResults v-if="circleSelectionActive" :sections="circleSections" :count="circlePhotos.length" @clear="clearCircleSelection(); emit('clear-location')" @select-photo="emit('select-photo', $event)" />
    <DiscoverPlacePanel v-else :locations="locations" :unlocated-photos="unlocatedPhotos" @select-photo="emit('select-photo', $event)" />
    <div class="map-attribution">{{ t('discover.attribution') }}</div>
  </section>
</template>

<style scoped>
.discover-map { background: var(--map-paper); height: 100svh; height: 100dvh; min-height: 620px; overflow: hidden; position: relative; width: 100%; }
.map-shell, .amap-container { height: 100%; inset: 0; position: absolute; width: 100%; }
.amap-container { background: var(--map-paper); }
.circle-overlay { background: color-mix(in srgb, var(--map-marker) 8%, transparent); border: 2px solid color-mix(in srgb, var(--map-marker) 84%, var(--map-ink)); border-radius: 50%; box-shadow: 0 0 0 1px color-mix(in srgb, var(--map-paper) 55%, transparent), 0 3px 18px color-mix(in srgb, var(--map-ink) 18%, transparent); pointer-events: none; position: absolute; transform: translateZ(0); z-index: 3; }
.circle-overlay.locked { background: color-mix(in srgb, var(--map-marker) 13%, transparent); border-color: var(--map-marker); }
.map-status { align-items: center; background: color-mix(in srgb, var(--map-surface) 92%, transparent); color: var(--map-muted); display: flex; font-size: 12px; inset: 0; justify-content: center; letter-spacing: .04em; position: absolute; z-index: 2; }
.map-status-error { color: var(--accent-deep); padding: 24px; text-align: center; }
.map-controls { align-items: center; display: grid; gap: 1px; position: absolute; right: 18px; top: 112px; z-index: 4; }
.map-control { align-items: center; background: var(--map-control); border: 1px solid var(--map-line); color: var(--map-muted); display: flex; height: 34px; justify-content: center; padding: 0; width: 34px; }
.map-control:first-child { border-radius: 5px 5px 0 0; }
.reset-control { border-radius: 0 0 5px 5px; margin-top: 6px; }
.map-control:hover { background: var(--map-control-hover); color: var(--map-ink); }
.zoom-readout { background: var(--map-control); color: var(--map-muted); font-size: 9px; padding: 4px 0; text-align: center; }
.map-attribution { bottom: 9px; color: var(--map-muted); font-size: 10px; position: absolute; right: 14px; z-index: 5; }
:deep(.amap-logo), :deep(.amap-copyright) { display: none !important; visibility: hidden !important; }
:deep(.amap-cluster-marker) { align-items: center; background: var(--map-cluster); border: 1px solid color-mix(in srgb, var(--map-marker) 35%, var(--map-ink)); border-radius: 50%; box-shadow: 0 2px 10px color-mix(in srgb, var(--map-ink) 48%, transparent); color: var(--map-cluster-ink); cursor: pointer; display: flex; font-size: 11px; font-weight: 700; justify-content: center; outline: none; position: relative; }
@media (max-width: 680px) {
  .discover-map { min-height: 100svh; min-height: 100dvh; }
  .map-controls { right: 12px; top: 106px; }
  .map-attribution { bottom: 164px; font-size: 9px; right: 10px; }
}
</style>
