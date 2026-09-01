<script setup lang="ts">
import { load as loadAMap } from '@amap/amap-jsapi-loader';
import { LoaderCircle, MapPin, Search, Trash2 } from 'lucide-vue-next';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { fromAMapCoordinates, toAMapCoordinates } from '../../lib/discover-map-data';
import type { PhotoCoordinates } from '../../stores/gallery';
import { useLocale } from '../../i18n';
import { mapStyleForTheme, useTheme } from '../../theme';

type LocationSelection = { name: string; displayAddress: string; region: string; latitude: number; longitude: number };
type AMapPlaceSearch = { search: (keyword: string, callback: (status: string, result: unknown) => void) => void };
type AMapPlace = { name?: unknown; address?: unknown; district?: unknown; type?: unknown; location?: unknown; pname?: unknown; cityname?: unknown; adname?: unknown; country?: unknown };
type LocationSuggestion = { name: string; address: string; district: string; region: string; position: [number, number] };
type AMapRuntime = typeof AMap & { PlaceSearch: new (options?: Record<string, unknown>) => AMapPlaceSearch };

const props = withDefaults(defineProps<{
  name: string;
  latitude: number | null | undefined;
  longitude: number | null | undefined;
  disabled?: boolean;
}>(), { disabled: false });

const emit = defineEmits<{
  (event: 'select', selection: LocationSelection): void;
  (event: 'clear'): void;
  (event: 'error', message: string): void;
}>();

const { t } = useLocale();
const { theme } = useTheme();
const amapKey = import.meta.env.VITE_AMAP_KEY?.trim();
const securityCode = import.meta.env.VITE_AMAP_SECURITY_CODE?.trim();
const mapContainer = ref<HTMLElement | null>(null);
const map = ref<AMap.Map | null>(null);
const amap = ref<AMapRuntime | null>(null);
const placeSearch = ref<AMapPlaceSearch | null>(null);
const marker = ref<AMap.Marker | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);
const query = ref(props.name);
const searching = ref(false);
const suggestions = ref<LocationSuggestion[]>([]);

function hasCoordinates(): boolean {
  return Number.isFinite(props.latitude) && Number.isFinite(props.longitude);
}

function currentCoordinates(): PhotoCoordinates | undefined {
  return hasCoordinates() ? { latitude: Number(props.latitude), longitude: Number(props.longitude) } : undefined;
}

function mapPosition(): [number, number] {
  const coordinates = currentCoordinates();
  return coordinates ? toAMapCoordinates(coordinates) : [104, 35];
}

function placeMarker(position: [number, number]): void {
  const currentAMap = amap.value;
  const currentMap = map.value;
  if (!currentAMap || !currentMap) return;
  marker.value?.setMap(null);
  marker.value = new currentAMap.Marker({ position });
  marker.value.setMap(currentMap);
}

function valueFromLocation(value: unknown): [number, number] | undefined {
  if (Array.isArray(value) && value.length >= 2 && Number.isFinite(Number(value[0])) && Number.isFinite(Number(value[1]))) return [Number(value[0]), Number(value[1])];
  if (value && typeof value === 'object') {
    const point = value as { getLng?: () => number; getLat?: () => number; lng?: number; lat?: number };
    const longitude = typeof point.getLng === 'function' ? point.getLng() : point.lng;
    const latitude = typeof point.getLat === 'function' ? point.getLat() : point.lat;
    if (Number.isFinite(longitude) && Number.isFinite(latitude)) return [Number(longitude), Number(latitude)];
  }
  return undefined;
}

function textValue(value: unknown): string {
  if (Array.isArray(value)) return value.map(textValue).filter(Boolean).join('，');
  return value === undefined || value === null ? '' : String(value).trim();
}

function suggestionFromPlace(value: unknown): LocationSuggestion | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const place = value as AMapPlace;
  const position = valueFromLocation(place.location);
  const name = textValue(place.name);
  if (!position || !name) return undefined;
  const region = textValue(place.pname) || textValue(place.cityname) || textValue(place.adname) || (textValue(place.country).toLocaleLowerCase() === '中国' ? '' : textValue(place.country));
  return { name, address: textValue(place.address) || textValue(place.type), district: textValue(place.district), region, position };
}

function emitPosition(position: [number, number], name = query.value.trim(), displayAddress = name, region = ''): void {
  const coordinates = fromAMapCoordinates(position);
  placeMarker(position);
  emit('select', { name, displayAddress, region, latitude: coordinates.latitude, longitude: coordinates.longitude });
}

function search(): void {
  const text = query.value.trim();
  if (!text || !placeSearch.value || searching.value) return;
  suggestions.value = [];
  error.value = null;
  searching.value = true;
  placeSearch.value.search(text, (status, result) => {
    searching.value = false;
    const pois = result && typeof result === 'object' ? (result as { poiList?: { pois?: unknown[] } }).poiList?.pois ?? [] : [];
    const next = status === 'complete' ? pois.map(suggestionFromPlace).filter((item): item is LocationSuggestion => Boolean(item)).slice(0, 5) : [];
    if (!next.length) {
      error.value = t('admin.locationSearchEmpty');
      emit('error', error.value);
      return;
    }
    error.value = null;
    suggestions.value = next;
  });
}

function selectSuggestion(suggestion: LocationSuggestion): void {
  suggestions.value = [];
  error.value = null;
  const searchText = query.value.trim();
  // Keep the selected POI's primary name in the search field; the secondary
  // address is useful for disambiguation in results but is not a display label.
  query.value = suggestion.name;
  map.value?.setZoomAndCenter(15, suggestion.position);
  emitPosition(suggestion.position, suggestion.name, searchText || suggestion.name, suggestion.region);
}

function clear(): void {
  marker.value?.setMap(null);
  marker.value = null;
  query.value = '';
  suggestions.value = [];
  error.value = null;
  emit('clear');
}

async function initMap(): Promise<void> {
  if (!amapKey) {
    loading.value = false;
    error.value = t('discover.amapMissing');
    return;
  }
  if (securityCode) window._AMapSecurityConfig = { securityJsCode: securityCode };
  try {
    const runtime = await loadAMap({ key: amapKey, version: '2.0', plugins: ['AMap.PlaceSearch'] }) as AMapRuntime;
    if (!mapContainer.value) return;
    amap.value = runtime;
    placeSearch.value = new runtime.PlaceSearch({ city: '全国', pageSize: 5, pageIndex: 1, extensions: 'all' });
    map.value = new runtime.Map(mapContainer.value, { center: mapPosition(), zoom: hasCoordinates() ? 12 : 4, mapStyle: mapStyleForTheme(theme.value), resizeEnable: true } as AMap.Map.Options);
    const selected = mapPosition();
    if (hasCoordinates()) placeMarker(selected);
    loading.value = false;
  } catch (cause) {
    loading.value = false;
    error.value = cause instanceof Error ? cause.message : t('discover.amapError');
    emit('error', error.value);
  }
}

watch(() => props.name, (value) => { if (!query.value.trim()) query.value = value; });
watch(query, () => { suggestions.value = []; });
watch(theme, (next) => { map.value?.setMapStyle(mapStyleForTheme(next)); });
watch(() => [props.latitude, props.longitude], () => {
  if (!map.value || !hasCoordinates()) return;
  const position = mapPosition();
  map.value.setCenter(position);
  placeMarker(position);
});
onMounted(() => { void initMap(); });
onBeforeUnmount(() => { marker.value?.setMap(null); marker.value = null; map.value?.destroy(); map.value = null; });
</script>

<template>
  <div class="location-picker">
    <div class="location-search">
      <label for="location-search">{{ t('admin.locationSearch') }}</label>
      <div class="search-row">
        <input id="location-search" v-model="query" :placeholder="t('admin.locationSearchPlaceholder')" :disabled="disabled || loading || !placeSearch" @keydown.enter.prevent="search" />
        <button type="button" :disabled="disabled || loading || searching || !placeSearch" :aria-label="t('admin.locationSearch')" :title="t('admin.locationSearch')" @click="search"><LoaderCircle v-if="searching" :size="15" class="spin" /><Search v-else :size="15" /></button>
      </div>
      <ul v-if="suggestions.length" class="location-results" role="listbox" :aria-label="t('admin.locationSearchResults')">
        <li v-for="suggestion in suggestions" :key="`${suggestion.name}-${suggestion.position.join(',')}`" role="option">
          <button type="button" :disabled="disabled" @click="selectSuggestion(suggestion)"><strong>{{ suggestion.name }}</strong><span v-if="suggestion.district || suggestion.address">{{ [suggestion.district, suggestion.address].filter(Boolean).join(' · ') }}</span></button>
        </li>
      </ul>
    </div>
    <div ref="mapContainer" class="location-map" :aria-busy="loading" />
    <div v-if="loading" class="location-map-status"><LoaderCircle :size="14" class="spin" /> {{ t('admin.locationMapLoading') }}</div>
    <div v-else-if="error" class="location-map-status location-map-error">{{ error }}</div>
    <p class="location-help"><MapPin :size="14" /> {{ t('admin.locationMapHint') }}</p>
    <button type="button" class="clear-location" :disabled="disabled" @click="clear"><Trash2 :size="14" /> {{ t('admin.clearLocation') }}</button>
  </div>
</template>

<style scoped>
.location-picker { border-top: 1px solid var(--line); display: grid; gap: 10px; margin-top: 3px; padding-top: 14px; }
.location-search { display: grid; gap: 6px; }
.location-search label { color: var(--muted); font-size: 11px; }
.search-row { display: flex; gap: 7px; }
.search-row input { flex: 1; min-width: 0; }
.search-row button, .clear-location { align-items: center; background: transparent; border: 1px solid var(--line); color: var(--muted); display: inline-flex; gap: 6px; justify-content: center; padding: 8px 11px; }
.search-row button:hover, .clear-location:hover { border-color: var(--ink); color: var(--ink); }
.search-row button:disabled, .clear-location:disabled { cursor: wait; opacity: .55; }
.location-results { background: var(--surface); border: 1px solid var(--line); list-style: none; margin: -1px 0 0; max-height: 220px; overflow-y: auto; padding: 0; position: relative; z-index: 2; }
.location-results li + li { border-top: 1px solid var(--line); }
.location-results button { background: transparent; display: grid; gap: 3px; padding: 10px 11px; text-align: left; width: 100%; }
.location-results button:hover, .location-results button:focus-visible { background: var(--surface-soft); outline: none; }
.location-results strong { color: var(--ink); font-size: 12px; font-weight: 550; }
.location-results span { color: var(--muted); font-size: 11px; line-height: 1.35; }
.location-map { background: var(--map-paper); border: 1px solid var(--line); height: 210px; overflow: hidden; width: 100%; }
.location-map-status { align-items: center; background: var(--surface-soft); color: var(--muted); display: flex; font-size: 11px; gap: 6px; justify-content: center; margin-top: -220px; min-height: 210px; pointer-events: none; position: relative; }
.location-map-error { color: var(--accent-deep); padding: 18px; text-align: center; }
.location-help { align-items: center; color: var(--muted); display: flex; font-size: 11px; gap: 5px; margin: 0; }
.clear-location { justify-self: start; font-size: 11px; }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
