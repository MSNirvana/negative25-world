<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { Aperture, CalendarDays, Camera, Focus, Gauge, MapPin, ScanLine, Star, Timer, X } from 'lucide-vue-next';
import { load as loadAMap } from '@amap/amap-jsapi-loader';
import type { GalleryPhoto } from '../stores/gallery';
import { useLocale } from '../i18n';
import { mapStyleForTheme, useTheme } from '../theme';
import { toAMapCoordinates } from '../lib/discover-map-data';

const props = defineProps<{ photo: GalleryPhoto }>();
const emit = defineEmits<{ (event: 'close'): void }>();
const { t } = useLocale();
const { theme } = useTheme();
const activeTab = ref<'parameters' | 'location'>('parameters');
const mapContainer = ref<HTMLElement | null>(null);
const map = shallowRef<AMap.Map | null>(null);
const amap = shallowRef<typeof AMap | null>(null);
const marker = shallowRef<AMap.Marker | null>(null);
const mapLoading = ref(false);
const mapError = ref<string | null>(null);
const amapKey = import.meta.env.VITE_AMAP_KEY?.trim();
const securityCode = import.meta.env.VITE_AMAP_SECURITY_CODE?.trim();
const stars = Array.from({ length: 7 }, (_, index) => index + 1);
const coordinates = computed(() => props.photo.coordinates);
const coordinateText = computed(() => coordinates.value ? `${coordinates.value.latitude.toFixed(5)}, ${coordinates.value.longitude.toFixed(5)}` : t('photo.notRecorded'));
const altitudeText = computed(() => props.photo.altitude === undefined ? t('photo.notRecorded') : `${Number.isInteger(props.photo.altitude) ? props.photo.altitude : props.photo.altitude.toFixed(1)} m`);

function mapPosition(): [number, number] {
  if (!coordinates.value) return [104, 35];
  return toAMapCoordinates(coordinates.value);
}

function placeMarker(): void {
  const currentMap = map.value;
  if (!currentMap) return;
  marker.value?.setMap(null);
  marker.value = null;
  if (!coordinates.value) return;
  const position = mapPosition();
  if (!amap.value) return;
  marker.value = new amap.value.Marker({ position, title: props.photo.location });
  marker.value.setMap(currentMap);
  currentMap.setZoomAndCenter(Math.max(currentMap.getZoom(), 11), position);
}

async function initMap(): Promise<void> {
  if (!coordinates.value) return;
  if (!amapKey) { mapError.value = t('discover.amapMissing'); return; }
  mapLoading.value = true;
  mapError.value = null;
  if (securityCode) window._AMapSecurityConfig = { securityJsCode: securityCode };
  try {
    const runtime = await loadAMap({ key: amapKey, version: '2.0' });
    await nextTick();
    if (!mapContainer.value) return;
    amap.value = runtime;
    const createdMap = new runtime.Map(mapContainer.value, { center: mapPosition(), zoom: 11, mapStyle: mapStyleForTheme(theme.value), resizeEnable: true, dragEnable: true, zoomEnable: true, scrollWheel: true } as AMap.Map.Options);
    map.value = createdMap;
    createdMap.on('complete', placeMarker);
    placeMarker();
  } catch (cause) {
    mapError.value = cause instanceof Error ? cause.message : t('discover.amapError');
  } finally {
    mapLoading.value = false;
  }
}

watch(theme, (next) => map.value?.setMapStyle(mapStyleForTheme(next)));
watch(() => props.photo.id, () => {
  activeTab.value = 'parameters';
  mapError.value = null;
  placeMarker();
});
watch(() => props.photo.coordinates, () => placeMarker(), { deep: true });
watch(activeTab, async (next) => {
  if (next !== 'location') return;
  await nextTick();
  if (!map.value) void initMap();
  else (map.value as (AMap.Map & { resize?: () => void })).resize?.();
});
onMounted(() => { void initMap(); });
onBeforeUnmount(() => { marker.value?.setMap(null); marker.value = null; map.value?.destroy(); map.value = null; });
</script>

<template>
  <div class="detail-overlay" role="presentation" @click.self="emit('close')" @touchstart.stop @touchend.stop>
    <aside class="detail-panel" role="dialog" aria-modal="true" :aria-label="t('photo.details')" @click.stop>
      <header class="detail-header">
        <div class="detail-tabs" role="tablist" :aria-label="t('photo.details')">
          <button type="button" role="tab" :aria-selected="activeTab === 'parameters'" :class="{ active: activeTab === 'parameters' }" @click="activeTab = 'parameters'">{{ t('photo.basicParameters') }}</button>
          <button type="button" role="tab" :aria-selected="activeTab === 'location'" :class="{ active: activeTab === 'location' }" @click="activeTab = 'location'">{{ t('photo.locationDetails') }}</button>
        </div>
        <button class="close-button" type="button" :aria-label="t('photo.closeDetails')" :title="t('photo.closeDetails')" @click="emit('close')"><X :size="19" /></button>
      </header>
      <section v-if="activeTab === 'parameters'" class="detail-content" role="tabpanel">
        <dl class="detail-grid">
          <div class="detail-card detail-rating"><dt><Star :size="15" /> {{ t('meta.rating') }}</dt><dd class="stars" role="img" :aria-label="t('meta.ratingValue', { rating: photo.rating ?? 0 })"><Star v-for="star in stars" :key="star" :size="17" :class="{ filled: photo.rating !== null && star <= photo.rating }" :fill="photo.rating !== null && star <= photo.rating ? 'currentColor' : 'none'" aria-hidden="true" /></dd></div>
          <div class="detail-card"><dt><CalendarDays :size="15" /> {{ t('meta.date') }}</dt><dd>{{ photo.capturedAt }}</dd></div>
          <div class="detail-card"><dt><Camera :size="15" /> {{ t('meta.camera') }}</dt><dd>{{ photo.camera }}</dd></div>
          <div class="detail-card"><dt><Focus :size="15" /> {{ t('meta.lens') }}</dt><dd>{{ photo.lens }}</dd></div>
          <div class="detail-card"><dt><ScanLine :size="15" /> {{ t('meta.focalLength') }}</dt><dd>{{ photo.focalLength }}</dd></div>
          <div class="detail-card"><dt><Aperture :size="15" /> {{ t('meta.aperture') }}</dt><dd>{{ photo.aperture }}</dd></div>
          <div class="detail-card"><dt><Timer :size="15" /> {{ t('meta.shutterSpeed') }}</dt><dd>{{ photo.shutterSpeed }}</dd></div>
          <div class="detail-card"><dt><Gauge :size="15" /> {{ t('meta.iso') }}</dt><dd>{{ photo.iso }}</dd></div>
        </dl>
      </section>
      <section v-else class="detail-content location-content" role="tabpanel">
        <div class="location-heading"><MapPin :size="16" /><div><span>{{ t('meta.place') }}</span><strong>{{ photo.location }}</strong></div></div>
        <div v-if="coordinates" class="location-map-wrap">
          <div ref="mapContainer" class="location-map" role="application" :aria-label="t('photo.locationMap')" :aria-busy="mapLoading" />
          <div v-if="mapLoading" class="map-status" role="status">{{ t('discover.amapLoading') }}</div>
          <div v-else-if="mapError" class="map-status map-status-error" role="status">{{ mapError }}</div>
        </div>
        <div v-else class="map-unavailable" role="status"><MapPin :size="20" /><span>{{ t('photo.mapUnavailable') }}</span></div>
        <dl class="coordinate-grid">
          <div><dt>{{ t('photo.latitude') }}</dt><dd>{{ coordinates ? coordinates.latitude.toFixed(5) : t('photo.notRecorded') }}</dd></div>
          <div><dt>{{ t('photo.longitude') }}</dt><dd>{{ coordinates ? coordinates.longitude.toFixed(5) : t('photo.notRecorded') }}</dd></div>
          <div><dt>{{ t('meta.altitude') }}</dt><dd>{{ altitudeText }}</dd></div>
          <div><dt>{{ t('meta.coordinates') }}</dt><dd>{{ coordinateText }}</dd></div>
        </dl>
      </section>
    </aside>
  </div>
</template>

<style scoped>
.detail-overlay { background: transparent; inset: 0; position: absolute; z-index: 7; }
.detail-panel { backdrop-filter: blur(18px) saturate(115%); background: color-mix(in srgb, var(--surface) 78%, transparent); border: 1px solid color-mix(in srgb, var(--line) 78%, transparent); border-radius: 12px; bottom: 40px; box-shadow: 0 16px 42px color-mix(in srgb, var(--ink) 18%, transparent); color: var(--ink); left: auto; max-height: min(68svh, 560px); max-width: 390px; overflow-y: auto; padding: 12px 16px 18px; position: absolute; right: 0; scrollbar-width: none; transform: none; width: min(390px, calc(100vw - 48px)); }
.detail-panel::-webkit-scrollbar { display: none; width: 0; }
.detail-panel::after { background: color-mix(in srgb, var(--surface) 78%, transparent); border-bottom: 1px solid color-mix(in srgb, var(--line) 78%, transparent); border-right: 1px solid color-mix(in srgb, var(--line) 78%, transparent); bottom: -8px; content: ''; height: 15px; pointer-events: none; position: absolute; right: 12px; transform: rotate(45deg); width: 15px; z-index: 0; }
.detail-header, .detail-content { position: relative; z-index: 1; }
.detail-header { align-items: center; display: flex; gap: 14px; justify-content: space-between; min-height: 34px; }
.close-button { align-items: center; background: transparent; color: var(--muted); display: inline-flex; height: 34px; justify-content: center; padding: 0; width: 34px; }
.close-button:hover { color: var(--ink); }
.detail-tabs { align-items: center; display: flex; gap: 7px; }
.detail-tabs button { background: transparent; border-radius: 999px; color: var(--muted); font-size: 12px; padding: 8px 15px; white-space: nowrap; }
.detail-tabs button:hover { color: var(--ink); }
.detail-tabs button.active { border-bottom-color: var(--accent-deep); color: var(--ink); }
.detail-tabs button.active { background: color-mix(in srgb, var(--ink) 14%, var(--surface)); }
.detail-content { padding-top: 11px; }
dt { align-items: center; color: var(--muted); display: flex; font-size: 10px; gap: 6px; letter-spacing: .08em; text-transform: uppercase; }
dd { color: var(--ink); font-family: Georgia, ui-serif, serif; font-size: 15px; font-weight: 700; line-height: 1.25; margin: 6px 0 0; }
.stars { align-items: center; color: var(--muted); display: flex; gap: 4px; }
.stars svg { stroke-width: 1.35; }
.stars .filled { color: var(--accent); }
.detail-grid { display: grid; gap: 9px; grid-template-columns: repeat(2, minmax(0, 1fr)); margin: 0; }
.detail-card { background: color-mix(in srgb, var(--surface-soft) 42%, transparent); border: 1px solid color-mix(in srgb, var(--line) 52%, transparent); border-radius: 10px; min-height: 88px; padding: 12px 14px; position: relative; }
.detail-card dt svg { color: color-mix(in srgb, var(--ink) 52%, transparent); flex: 0 0 auto; }
.detail-grid div { min-width: 0; }
.detail-grid dd { overflow-wrap: anywhere; }
.detail-rating { align-items: flex-start; display: flex; flex-direction: column; }
.detail-rating .stars { margin-top: 18px; }
.location-heading { align-items: center; border-bottom: 1px solid var(--line); display: flex; gap: 11px; padding-bottom: 20px; }
.location-heading svg { color: var(--accent-deep); flex: 0 0 auto; }
.location-heading div { display: grid; gap: 5px; min-width: 0; }
.location-heading span { color: var(--muted); font-size: 10px; letter-spacing: .08em; text-transform: uppercase; }
.location-heading strong { color: var(--ink); font-family: Georgia, ui-serif, serif; font-size: 16px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.location-map-wrap { background: var(--surface-soft); height: 235px; margin-top: 22px; overflow: hidden; position: relative; }
.location-map { height: 100%; width: 100%; }
.map-status { align-items: center; background: color-mix(in srgb, var(--surface) 90%, transparent); color: var(--muted); display: flex; font-size: 11px; inset: 0; justify-content: center; position: absolute; }
.map-status-error { color: var(--accent-deep); padding: 20px; text-align: center; }
.map-unavailable { align-items: center; background: var(--surface-soft); color: var(--muted); display: flex; flex-direction: column; font-size: 12px; gap: 10px; justify-content: center; min-height: 150px; text-align: center; }
.coordinate-grid { display: grid; gap: 12px; grid-template-columns: repeat(2, minmax(0, 1fr)); margin: 15px 0 0; }
.coordinate-grid > div { background: color-mix(in srgb, var(--surface-soft) 42%, transparent); border: 1px solid color-mix(in srgb, var(--line) 52%, transparent); border-radius: 10px; min-height: 82px; padding: 14px; }
@media (max-width: 680px) { .detail-panel { bottom: 38px; max-height: min(68svh, 540px); padding: 10px 12px 16px; right: 0; width: min(390px, calc(100vw - 28px)); } .detail-header { gap: 8px; } .detail-tabs { gap: 2px; } .detail-tabs button { font-size: 11px; padding: 8px 10px; } .detail-card { min-height: 84px; padding: 11px 12px; } .detail-rating .stars { margin-top: 16px; } .location-map-wrap { height: 200px; } }
</style>
