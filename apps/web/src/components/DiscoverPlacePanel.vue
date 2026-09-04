<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { ArrowLeft, ChevronDown, ChevronRight, ImageOff, MapPin, Search } from 'lucide-vue-next';
import type { GalleryPhoto } from '../stores/gallery';
import { DISCOVER_GROUPS, filterLocations, type DiscoverGroupId, type DiscoverLocation } from '../lib/discover-map-data';
import { useLocale } from '../i18n';

const props = defineProps<{
  locations: DiscoverLocation[];
  unlocatedPhotos: GalleryPhoto[];
}>();

const emit = defineEmits<{
  (event: 'select-photo', photo: GalleryPhoto): void;
}>();

const query = ref('');
const expanded = ref(true);
const expandedGroups = ref<Record<'featured' | 'recent', boolean>>({ featured: true, recent: true });
const selectedLocation = ref<DiscoverLocation | null>(null);
const mobile = ref(false);
const { t } = useLocale();
let mediaQuery: MediaQueryList | null = null;

const hasSearch = computed(() => query.value.trim().length > 0);
const searchResults = computed(() => filterLocations(props.locations, query.value));
const searchPhotoResults = computed(() => {
  const needle = query.value.trim().toLocaleLowerCase();
  if (!needle) return [];
  return props.unlocatedPhotos.filter((photo) => `${photo.title} ${photo.caption} ${photo.location}`.toLocaleLowerCase().includes(needle));
});
const sections = computed(() => DISCOVER_GROUPS.filter((group) => group.id !== 'unlocated').map((group) => ({ group, locations: locationsForGroup(group.id) })).filter((section) => section.locations.length));
const featuredLocations = computed(() => locationsForGroup('featured'));
const unlocated = computed(() => props.unlocatedPhotos);
const mappedCount = computed(() => props.locations.length);

function locationsForGroup(group: DiscoverGroupId): DiscoverLocation[] {
  const locations = props.locations;
  if (group === 'featured') return [...locations].sort((a, b) => (b.photos.length - a.photos.length) || a.name.localeCompare(b.name)).slice(0, 10);
  if (group === 'recent') return [...locations].sort((a, b) => latestPhotoTime(b) - latestPhotoTime(a)).slice(0, 10);
  return locations.filter((location) => location.group === group);
}
function groupLabel(group: DiscoverGroupId): string {
  if (group === 'unlocated') return t('discover.unlocated');
  if (group === 'asia') return '';
  return t(`discover.group.${group}`);
}

function latestPhotoTime(location: DiscoverLocation): number {
  return location.photos.reduce((latest, photo) => Math.max(latest, Date.parse(photo.capturedAt) || 0), 0);
}

function selectLocation(location: DiscoverLocation): void { selectedLocation.value = location; }
function selectPhoto(photo: GalleryPhoto): void { emit('select-photo', photo); }
function onRailWheel(event: WheelEvent): void {
  const rail = event.currentTarget as HTMLElement;
  if (rail.scrollWidth <= rail.clientWidth) return;
  if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
  rail.scrollLeft += event.deltaY;
  event.preventDefault();
}
function toggleExpanded(): void { expanded.value = !expanded.value; }
function toggleGroup(group: 'featured' | 'recent'): void { expandedGroups.value[group] = !expandedGroups.value[group]; }
function isGroupCollapsible(group: DiscoverGroupId): group is 'featured' | 'recent' { return group === 'featured' || group === 'recent'; }
function isGroupExpanded(group: DiscoverGroupId): boolean { return !isGroupCollapsible(group) || expandedGroups.value[group]; }
function clearSearch(): void { query.value = ''; selectedLocation.value = null; }
function backToSearch(): void { selectedLocation.value = null; }
function onMediaChange(event: MediaQueryListEvent): void { mobile.value = event.matches; if (!event.matches) expanded.value = true; }

watch(query, () => { selectedLocation.value = null; });

onMounted(() => {
  mediaQuery = window.matchMedia('(max-width: 680px)');
  mobile.value = mediaQuery.matches;
  expanded.value = !mobile.value;
  mediaQuery.addEventListener('change', onMediaChange);
});
onBeforeUnmount(() => mediaQuery?.removeEventListener('change', onMediaChange));
</script>

<template>
  <aside class="place-panel" :class="{ expanded, mobile }" :aria-label="t('discover.places')" @click.stop @pointerdown.stop @pointermove.stop @touchstart.stop @touchmove.stop @wheel.stop>
    <button class="panel-toggle" :aria-expanded="expanded" :aria-label="t('discover.togglePanel')" @click="toggleExpanded">
      <ChevronDown :size="19" />
    </button>
    <div class="panel-scroll">
      <label class="place-search">
        <Search :size="16" aria-hidden="true" />
        <input v-model="query" type="search" :placeholder="t('discover.searchPlaceholder')" :aria-label="t('discover.searchLabel')" />
        <button v-if="query" class="clear-search" type="button" :aria-label="t('discover.clearSearch')" @click="clearSearch">×</button>
      </label>

      <div v-if="!hasSearch && !selectedLocation" class="panel-meta">
        <span>{{ t('discover.fieldNotes') }}</span>
        <strong>{{ t('discover.mappedCount', { count: mappedCount }) }}</strong>
      </div>

      <section v-if="selectedLocation" class="location-result" :aria-label="selectedLocation.name">
        <header class="result-heading">
          <button class="result-back" type="button" :aria-label="t('discover.backToSearch')" @click="backToSearch"><ArrowLeft :size="16" /></button>
          <div>
            <h2>{{ selectedLocation.name }}</h2>
            <small v-if="groupLabel(selectedLocation.group)">{{ groupLabel(selectedLocation.group) }}</small>
          </div>
          <span>{{ selectedLocation.photos.length }}</span>
        </header>
        <div v-if="selectedLocation.photos.length" class="result-grid">
          <button v-for="photo in selectedLocation.photos" :key="photo.id" class="result-photo" type="button" :aria-label="t('photo.open', { title: photo.title })" @click="selectPhoto(photo)">
            <img :src="photo.image" :alt="photo.title" loading="lazy" />
          </button>
        </div>
        <div v-else class="panel-empty"><MapPin :size="18" /><p>{{ t('discover.markedNoPhotos') }}</p></div>
      </section>

      <section v-else-if="hasSearch" class="search-results" :aria-label="t('discover.searchLabel')">
        <button v-for="location in searchResults" :key="location.id" class="search-result" type="button" @click="selectLocation(location)">
          <span class="search-result-copy"><strong>{{ location.name }}</strong><small v-if="groupLabel(location.group)">{{ groupLabel(location.group) }}</small></span>
          <span class="search-result-count">{{ location.photos.length }}</span>
          <ChevronRight :size="16" aria-hidden="true" />
        </button>
        <template v-if="!searchResults.length">
          <button v-for="photo in searchPhotoResults" :key="photo.id" class="search-result" type="button" :aria-label="t('discover.unlocatedPhoto', { title: photo.title })" @click="selectPhoto(photo)">
            <span class="search-result-copy"><strong>{{ photo.title }}</strong><small>{{ t('discover.unlocated') }}</small></span>
            <ChevronRight :size="16" aria-hidden="true" />
          </button>
        </template>
        <div v-if="!searchResults.length && !searchPhotoResults.length" class="panel-empty"><MapPin :size="18" /><p>{{ t('discover.noMatch') }}</p></div>
      </section>

      <template v-else-if="expanded">
        <section v-for="section in sections" :key="section.group.id" class="place-section" :aria-labelledby="`group-${section.group.id}`">
          <button v-if="isGroupCollapsible(section.group.id)" class="section-toggle" type="button" :aria-expanded="isGroupExpanded(section.group.id)" @click="toggleGroup(section.group.id)">
            <span class="section-heading"><h2 :id="`group-${section.group.id}`">{{ groupLabel(section.group.id) }}</h2><span>{{ section.locations.length }}</span></span>
            <ChevronDown :size="18" aria-hidden="true" />
          </button>
          <div v-else class="section-heading"><h2 :id="`group-${section.group.id}`">{{ groupLabel(section.group.id) }}</h2><span>{{ section.locations.length }}</span></div>
          <div v-if="isGroupExpanded(section.group.id)" class="place-rail" tabindex="0" :aria-label="t('discover.locationGroup', { group: groupLabel(section.group.id) })" @wheel.stop="onRailWheel">
            <button v-for="location in section.locations" :key="location.id" class="place-card" :aria-label="t('discover.locationMarker', { name: location.name, count: t('discover.photoCount', { count: location.photos.length }) })" @click="selectLocation(location)">
              <span v-if="location.coverPhoto" class="card-image" :style="{ backgroundImage: `url(${location.coverPhoto.image})` }"></span>
              <span v-else class="card-image card-image-empty"><MapPin :size="21" /></span>
              <span class="card-scrim" aria-hidden="true"></span>
              <strong>{{ location.name }}</strong>
              <small>{{ location.photos.length }} {{ t(location.photos.length === 1 ? 'discover.photoSingular' : 'discover.photoPlural') }}</small>
            </button>
          </div>
        </section>

        <section class="place-section unlocated-section" aria-labelledby="group-unlocated">
          <div class="section-heading">
            <h2 id="group-unlocated">{{ t('discover.unlocated') }}</h2>
            <span>{{ unlocated.length }}</span>
          </div>
          <div v-if="unlocated.length" class="place-rail" tabindex="0" :aria-label="t('discover.unlocatedLabel')" @wheel.stop="onRailWheel">
            <button v-for="photo in unlocated" :key="photo.id" class="place-card" :aria-label="t('discover.unlocatedPhoto', { title: photo.title })" @click="selectPhoto(photo)">
              <span class="card-image" :style="{ backgroundImage: `url(${photo.image})` }"></span>
              <span class="card-scrim" aria-hidden="true"></span>
              <strong>{{ photo.title }}</strong>
              <small>{{ t('discover.waitingGps') }}</small>
            </button>
          </div>
          <div v-else class="unlocated-empty"><ImageOff :size="17" /><span>{{ t('discover.noGps') }}</span></div>
        </section>

        <div v-if="!sections.length && !unlocated.length" class="panel-empty">
          <MapPin :size="18" />
          <p>{{ t('discover.noMatch') }}</p>
        </div>
      </template>
      <section v-else class="place-section peek-section" :aria-label="t('discover.group.featured')">
        <button class="section-toggle" type="button" :aria-expanded="false" @click="expanded = true">
          <span class="section-heading"><h2>{{ t('discover.group.featured') }}</h2><span>{{ featuredLocations.length }}</span></span>
          <ChevronDown :size="18" aria-hidden="true" />
        </button>
        <div v-if="featuredLocations.length" class="place-rail" @wheel.stop="onRailWheel">
          <button v-for="location in featuredLocations.slice(0, 3)" :key="location.id" class="place-card" @click="selectLocation(location)">
            <span v-if="location.coverPhoto" class="card-image" :style="{ backgroundImage: `url(${location.coverPhoto.image})` }"></span>
            <span v-else class="card-image card-image-empty"><MapPin :size="21" /></span>
            <span class="card-scrim" aria-hidden="true"></span>
            <strong>{{ location.name }}</strong>
          </button>
        </div>
      </section>
    </div>
  </aside>
</template>

<style scoped>
.place-panel { background: var(--map-surface); border-radius: 14px 14px 0 0; bottom: 0; box-shadow: var(--shadow); color: var(--map-ink); left: 8px; max-height: min(704px, calc(100svh - 16px)); overflow: hidden; pointer-events: auto; position: absolute; touch-action: pan-y; transition: height .28s ease, transform .28s ease; width: min(395px, calc(100% - 16px)); z-index: 8; }
.place-panel.mobile { border-radius: 15px 15px 0 0; left: 0; max-height: min(62svh, 560px); width: 100%; }
.place-panel:not(.mobile) { height: min(704px, 62svh); }
.place-panel.mobile:not(.expanded) { height: 158px; }
.place-panel.mobile.expanded { height: min(62svh, 560px); }
.place-panel:not(.mobile):not(.expanded) { height: 158px; }
.panel-toggle { align-items: center; background: transparent; color: var(--map-muted); display: flex; height: 40px; justify-content: center; padding: 0; position: absolute; right: 0; top: 0; width: 100%; z-index: 2; }
.panel-toggle svg { transition: transform .24s ease; }
.place-panel:not(.expanded) .panel-toggle svg { transform: rotate(180deg); }
.panel-scroll { height: 100%; overflow-x: hidden; overflow-y: auto; padding: 40px 16px calc(40px + env(safe-area-inset-bottom)); scrollbar-width: thin; }
.place-search { align-items: center; border: 1px solid var(--map-line); border-radius: 999px; color: var(--map-muted); display: flex; gap: 8px; min-height: 31px; padding: 5px 11px; }
.place-search input { background: transparent; border: 0; color: var(--map-ink); font-size: 13px; min-width: 0; outline: 0; width: 100%; }
.place-search input::-webkit-search-cancel-button { -webkit-appearance: none; appearance: none; }
.place-search input::-ms-clear { display: none; }
.place-search input::placeholder { color: var(--map-muted); }
.clear-search { background: transparent; color: var(--map-muted); font-size: 17px; line-height: 1; padding: 0 2px; }
.panel-meta { align-items: center; color: var(--map-muted); display: flex; font-size: 10px; justify-content: space-between; letter-spacing: .05em; margin: 13px 1px 0; text-transform: uppercase; }
.panel-meta strong { color: var(--map-ink); font-size: 10px; font-weight: 600; letter-spacing: 0; text-transform: none; }
.place-section { margin-top: 26px; }
.section-heading { align-items: baseline; display: flex; gap: 9px; margin-bottom: 11px; }
.section-heading h2 { font-family: Georgia, ui-serif, serif; font-size: 21px; font-weight: 500; line-height: 1.2; margin: 0; }
.section-heading h2::after { content: none; }
.section-heading span { color: var(--map-muted); font-size: 11px; }
.section-toggle { align-items: center; background: transparent; color: inherit; display: flex; justify-content: space-between; padding: 0; width: 100%; }
.section-toggle > svg { color: var(--map-muted); flex: 0 0 auto; transition: transform .2s ease; }
.section-toggle[aria-expanded='false'] > svg { transform: rotate(-90deg); }
.section-toggle .section-heading { margin-bottom: 11px; }
.search-results { border-top: 1px solid var(--map-line); margin-top: 20px; }
.search-result { align-items: center; background: transparent; border-bottom: 1px solid var(--map-line); color: var(--map-ink); display: flex; gap: 10px; padding: 13px 2px; text-align: left; width: 100%; }
.search-result:hover, .search-result:focus-visible { background: var(--map-surface-soft); }
.search-result-copy { display: grid; gap: 4px; min-width: 0; }
.search-result-copy strong { font-family: Georgia, ui-serif, serif; font-size: 17px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.search-result-copy small { color: var(--map-muted); font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.search-result-count { color: var(--map-muted); font-size: 11px; margin-left: auto; }
.search-result > svg { color: var(--map-muted); flex: 0 0 auto; }
.location-result { border-top: 1px solid var(--map-line); margin-top: 20px; }
.result-heading { align-items: center; display: flex; gap: 10px; padding: 14px 0 12px; }
.result-heading h2 { font-family: Georgia, ui-serif, serif; font-size: 22px; font-weight: 500; line-height: 1.15; margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.result-heading small { color: var(--map-muted); display: block; font-size: 10px; margin-top: 4px; }
.result-heading > span { color: var(--map-muted); font-size: 12px; margin-left: auto; }
.result-back { align-items: center; background: transparent; color: var(--map-muted); display: inline-flex; flex: 0 0 auto; justify-content: center; padding: 4px; }
.result-back:hover { color: var(--map-ink); }
.result-grid { display: grid; gap: 3px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.result-photo { aspect-ratio: 1; background: var(--map-surface-soft); display: block; overflow: hidden; padding: 0; }
.result-photo img { display: block; height: 100%; object-fit: cover; transition: opacity .2s ease, transform .3s ease; width: 100%; }
.result-photo:hover img, .result-photo:focus-visible img { opacity: .82; transform: scale(1.03); }
.result-photo:focus-visible { outline: 2px solid var(--accent-deep); outline-offset: -2px; }
.place-rail { -webkit-overflow-scrolling: touch; cursor: grab; display: flex; gap: 16px; margin-right: -16px; overflow-x: auto; overscroll-behavior-x: contain; padding: 0 16px 12px 0; scroll-snap-type: x mandatory; scrollbar-width: none; touch-action: pan-x; user-select: none; }
.place-rail:active { cursor: grabbing; }
.place-rail::-webkit-scrollbar { display: none; }
.place-card { background: var(--map-surface-soft); border-radius: 13px; color: #fff; flex: 0 0 168px; height: 168px; overflow: hidden; padding: 0; position: relative; scroll-snap-align: start; text-align: left; transition: transform .2s ease, box-shadow .2s ease; }
.place-card:hover, .place-card:focus-visible, .place-card.selected { box-shadow: var(--shadow); transform: translateY(-2px); }
.card-image, .card-scrim { inset: 0; position: absolute; }
.card-image { background: var(--map-surface-soft) center / cover no-repeat; }
.card-image-empty { align-items: center; color: var(--map-muted); display: flex; justify-content: center; }
.card-scrim { background: linear-gradient(180deg, rgba(0,0,0,.02) 24%, rgba(0,0,0,.7) 100%); }
.place-card strong { bottom: 30px; font-family: Georgia, ui-serif, serif; font-size: 18px; font-weight: 500; left: 14px; line-height: 1.08; max-width: calc(100% - 28px); overflow: hidden; position: absolute; text-overflow: ellipsis; text-shadow: 0 1px 8px rgba(0,0,0,.35); white-space: nowrap; z-index: 1; }
.place-card small { bottom: 13px; color: rgba(255,255,255,.78); font-size: 10px; left: 14px; position: absolute; z-index: 1; }
.unlocated-section { border-top: 1px solid var(--map-line); padding-top: 4px; }
.unlocated-empty { align-items: center; color: var(--map-muted); display: flex; font-size: 12px; gap: 8px; line-height: 1.45; padding: 4px 4px 13px; }
.panel-empty { align-items: center; color: var(--map-muted); display: flex; font-size: 12px; gap: 8px; line-height: 1.5; padding: 30px 4px; }
.panel-empty p { margin: 0; }
@media (max-width: 680px) {
  .panel-scroll { padding: 40px 16px calc(40px + env(safe-area-inset-bottom)); }
  .panel-meta { margin-top: 11px; }
  .place-section { margin-top: 25px; }
  .place-card { flex-basis: 168px; height: 168px; }
  .place-rail { margin-right: -16px; }
}
</style>
