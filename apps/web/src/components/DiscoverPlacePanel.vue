<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { ChevronDown, ChevronRight, ImageOff, MapPin, Search } from 'lucide-vue-next';
import type { GalleryPhoto } from '../stores/gallery';
import { DISCOVER_GROUPS, filterLocations, type DiscoverGroupId, type DiscoverLocation } from '../lib/discover-map-data';
import { useLocale } from '../i18n';

const props = withDefaults(defineProps<{
  locations: DiscoverLocation[];
  unlocatedPhotos: GalleryPhoto[];
  selectedId?: string | null;
  locationError?: string | null;
}>(), { selectedId: null, locationError: null });

const emit = defineEmits<{
  (event: 'select-location', location: DiscoverLocation): void;
  (event: 'select-photo', photo: GalleryPhoto): void;
}>();

const query = ref('');
const expanded = ref(true);
const mobile = ref(false);
const { t } = useLocale();
let mediaQuery: MediaQueryList | null = null;

// Keep the map's place panel compact while the desktop detail view is open.
const compact = computed(() => Boolean(props.selectedId) && !mobile.value);

const searchedLocations = computed(() => filterLocations(props.locations, query.value));
const sections = computed(() => DISCOVER_GROUPS.filter((group) => group.id !== 'unlocated').map((group) => ({ group, locations: locationsForGroup(group.id) })).filter((section) => section.locations.length));
const unlocated = computed(() => {
  const normalized = query.value.trim().toLowerCase();
  if (!normalized) return props.unlocatedPhotos;
  return props.unlocatedPhotos.filter((photo) => `${photo.title} ${photo.caption}`.toLowerCase().includes(normalized));
});
const mappedCount = computed(() => searchedLocations.value.length);

function locationsForGroup(group: DiscoverGroupId): DiscoverLocation[] {
  const locations = searchedLocations.value;
  if (group === 'featured') return [...locations].sort((a, b) => (b.photos.length - a.photos.length) || a.name.localeCompare(b.name)).slice(0, 10);
  if (group === 'recent') return [...locations].sort((a, b) => latestPhotoTime(b) - latestPhotoTime(a)).slice(0, 10);
  return locations.filter((location) => location.group === group);
}
function groupLabel(group: DiscoverGroupId): string { return group === 'unlocated' ? t('discover.unlocated') : t(`discover.group.${group}`); }

function latestPhotoTime(location: DiscoverLocation): number {
  return location.photos.reduce((latest, photo) => Math.max(latest, Date.parse(photo.capturedAt) || 0), 0);
}

function selectLocation(location: DiscoverLocation): void { emit('select-location', location); }
function selectPhoto(photo: GalleryPhoto): void { emit('select-photo', photo); }
function toggleExpanded(): void { expanded.value = !expanded.value; }
function onMediaChange(event: MediaQueryListEvent): void { mobile.value = event.matches; if (!event.matches) expanded.value = true; }

onMounted(() => {
  mediaQuery = window.matchMedia('(max-width: 680px)');
  mobile.value = mediaQuery.matches;
  expanded.value = !mobile.value;
  mediaQuery.addEventListener('change', onMediaChange);
});
onBeforeUnmount(() => mediaQuery?.removeEventListener('change', onMediaChange));
</script>

<template>
  <aside class="place-panel" :class="{ expanded, mobile, compact }" :aria-label="t('discover.places')">
    <button class="panel-toggle" :aria-expanded="expanded && !compact" :aria-label="t('discover.togglePanel')" @click="toggleExpanded">
      <ChevronDown :size="19" />
    </button>
    <div class="panel-scroll">
      <label class="place-search">
        <Search :size="16" aria-hidden="true" />
        <input v-model="query" type="search" :placeholder="t('discover.searchPlaceholder')" :aria-label="t('discover.searchLabel')" />
        <button v-if="query" class="clear-search" type="button" :aria-label="t('discover.clearSearch')" @click="query = ''">×</button>
      </label>

      <div class="panel-meta">
        <span>{{ t('discover.fieldNotes') }}</span>
        <strong>{{ t('discover.mappedCount', { count: mappedCount }) }}</strong>
      </div>

      <p v-if="locationError" class="panel-notice" role="status">{{ t('discover.locationUnavailable') }}</p>

      <template v-if="expanded && !compact">
        <section v-for="section in sections" :key="section.group.id" class="place-section" :aria-labelledby="`group-${section.group.id}`">
          <div class="section-heading">
            <h2 :id="`group-${section.group.id}`">{{ groupLabel(section.group.id) }}</h2>
            <span>{{ section.locations.length }}</span>
          </div>
          <div class="place-rail" tabindex="0" :aria-label="t('discover.locationGroup', { group: groupLabel(section.group.id) })">
            <button v-for="location in section.locations" :key="location.id" class="place-card" :class="{ selected: selectedId === location.id }" :aria-label="t('discover.locationMarker', { name: location.name, count: t('discover.photoCount', { count: location.photos.length }) })" @click="selectLocation(location)">
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
          <div v-if="unlocated.length" class="place-rail" tabindex="0" :aria-label="t('discover.unlocatedLabel')">
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
        <div class="section-heading"><h2>{{ t('discover.group.featured') }}</h2><span>{{ sections[0]?.locations.length || 0 }}</span></div>
        <div v-if="sections[0]?.locations.length" class="place-rail" aria-hidden="true">
          <button v-for="location in sections[0].locations.slice(0, 3)" :key="location.id" class="place-card" tabindex="-1" @click="selectLocation(location)">
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
.place-panel { background: var(--map-surface); border-radius: 14px 14px 0 0; bottom: 0; box-shadow: var(--shadow); color: var(--map-ink); left: 8px; max-height: min(704px, calc(100svh - 16px)); overflow: hidden; position: absolute; transition: height .28s ease, transform .28s ease; width: min(395px, calc(100% - 16px)); z-index: 8; }
.place-panel.mobile { border-radius: 15px 15px 0 0; left: 0; max-height: min(62svh, 560px); width: 100%; }
.place-panel:not(.mobile) { height: min(704px, 62svh); }
.place-panel.mobile:not(.expanded) { height: 158px; }
.place-panel.mobile.expanded { height: min(62svh, 560px); }
.place-panel:not(.mobile):not(.expanded) { height: 158px; }
.place-panel:not(.mobile).compact { height: 158px; }
.panel-toggle { align-items: center; background: transparent; color: var(--map-muted); display: flex; height: 34px; justify-content: center; padding: 0; position: absolute; right: 0; top: 0; width: 100%; z-index: 2; }
.panel-toggle svg { transition: transform .24s ease; }
.place-panel:not(.expanded) .panel-toggle svg { transform: rotate(180deg); }
.place-panel.compact .panel-toggle svg { transform: rotate(180deg); }
.panel-scroll { height: 100%; overflow: auto hidden; padding: 34px 16px 40px; scrollbar-width: thin; }
.place-search { align-items: center; border: 1px solid var(--map-line); border-radius: 999px; color: var(--map-muted); display: flex; gap: 8px; min-height: 31px; padding: 5px 11px; }
.place-search input { background: transparent; border: 0; color: var(--map-ink); font-size: 13px; min-width: 0; outline: 0; width: 100%; }
.place-search input::placeholder { color: var(--map-muted); }
.clear-search { background: transparent; color: var(--map-muted); font-size: 17px; line-height: 1; padding: 0 2px; }
.panel-meta { align-items: center; color: var(--map-muted); display: flex; font-size: 10px; justify-content: space-between; letter-spacing: .05em; margin: 13px 1px 0; text-transform: uppercase; }
.panel-meta strong { color: var(--map-ink); font-size: 10px; font-weight: 600; letter-spacing: 0; text-transform: none; }
.panel-notice { background: var(--map-surface-soft); border-radius: 5px; color: var(--map-muted); font-size: 11px; line-height: 1.45; margin: 13px 0 0; padding: 8px 10px; }
.place-section { margin-top: 26px; }
.section-heading { align-items: baseline; display: flex; gap: 9px; margin-bottom: 11px; }
.section-heading h2 { font-family: Georgia, ui-serif, serif; font-size: 21px; font-weight: 500; line-height: 1.2; margin: 0; }
.section-heading h2::after { color: var(--map-muted); content: '›'; font-family: inherit; font-size: 24px; margin-left: 6px; vertical-align: -1px; }
.section-heading span { color: var(--map-muted); font-size: 11px; }
.place-rail { display: flex; gap: 16px; margin-right: -16px; overflow-x: auto; overscroll-behavior-x: contain; padding: 0 16px 12px 0; scroll-snap-type: x mandatory; scrollbar-width: none; }
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
  .panel-scroll { padding-left: 16px; padding-right: 16px; }
  .panel-meta { margin-top: 11px; }
  .place-section { margin-top: 25px; }
  .place-card { flex-basis: 168px; height: 168px; }
  .place-rail { margin-right: -16px; }
}
</style>
