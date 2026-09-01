<script setup lang="ts">
import { Check, ChevronDown, LocateFixed, Search, X } from 'lucide-vue-next';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { GalleryPhoto } from '../stores/gallery';
import { useLocale } from '../i18n';
import { buildLocationOptions, displayLocationLabel, type LocationOption } from '../lib/location-options';

const props = defineProps<{ active: boolean; selectedLocation: string | null; photos: readonly GalleryPhoto[] }>();
const emit = defineEmits<{
  (event: 'select-mode'): void;
  (event: 'select-location', value: string | null): void;
}>();

const { locale, t } = useLocale();
const root = ref<HTMLElement | null>(null);
const popover = ref<HTMLElement | null>(null);
const searchInput = ref<HTMLInputElement | null>(null);
const open = ref(false);
const query = ref('');
const popoverPosition = ref({ left: 16, top: 16 });
const options = computed(() => buildLocationOptions(props.photos));
const chinaOptions = computed(() => filterOptions(options.value.filter((option) => option.group === 'china')));
const otherOptions = computed(() => filterOptions(options.value.filter((option) => option.group === 'other')));
const hasResults = computed(() => chinaOptions.value.length > 0 || otherOptions.value.length > 0);

function filterOptions(values: LocationOption[]): LocationOption[] {
  const needle = query.value.trim().toLocaleLowerCase();
  if (!needle) return values;
  return values.filter((option) => `${option.label} ${option.labelEn}`.toLocaleLowerCase().includes(needle));
}
function toggle(): void {
  open.value = !open.value;
  emit('select-mode');
  if (open.value) void nextTick(() => {
    updatePopoverPosition();
    searchInput.value?.focus();
  });
}
function selectLocation(value: string | null): void {
  emit('select-location', value);
  open.value = false;
  query.value = '';
}
function updatePopoverPosition(): void {
  const trigger = root.value?.getBoundingClientRect();
  if (!trigger) return;
  const popoverWidth = Math.min(350, window.innerWidth - 32);
  const popoverHeight = popover.value?.getBoundingClientRect().height ?? 0;
  popoverPosition.value = {
    left: Math.max(16, Math.min(trigger.left - 10, window.innerWidth - popoverWidth - 16)),
    top: Math.max(16, Math.min(trigger.bottom + 12, window.innerHeight - popoverHeight - 16)),
  };
}
function closeOnOutside(event: PointerEvent): void {
  const target = event.target as Node;
  if (!root.value?.contains(target) && !popover.value?.contains(target)) open.value = false;
}
function closeOnEscape(event: KeyboardEvent): void { if (event.key === 'Escape') open.value = false; }
watch(() => props.active, (active) => { if (!active) open.value = false; });
onMounted(() => {
  document.addEventListener('pointerdown', closeOnOutside);
  document.addEventListener('keydown', closeOnEscape);
  window.addEventListener('resize', updatePopoverPosition);
  window.addEventListener('scroll', updatePopoverPosition, true);
});
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', closeOnOutside);
  document.removeEventListener('keydown', closeOnEscape);
  window.removeEventListener('resize', updatePopoverPosition);
  window.removeEventListener('scroll', updatePopoverPosition, true);
});
</script>

<template>
  <div ref="root" class="location-picker">
    <button class="location-trigger" type="button" :class="{ active: active || open }" :aria-expanded="open" aria-haspopup="dialog" @click.stop="toggle">
      <LocateFixed :size="14" aria-hidden="true" />
      {{ t('gallery.region') }}
      <ChevronDown :size="13" class="location-chevron" aria-hidden="true" />
    </button>
    <Teleport to="body">
    <div v-if="open" ref="popover" class="location-popover" role="dialog" :aria-label="t('gallery.locationHeading')" :style="{ left: `${popoverPosition.left}px`, top: `${popoverPosition.top}px` }">
      <div class="location-popover-head">
        <strong>{{ t('gallery.locationHeading') }}</strong>
        <button class="location-close" type="button" :aria-label="t('gallery.closeLocationPicker')" @click="open = false"><X :size="15" aria-hidden="true" /></button>
      </div>
      <label class="location-search">
        <Search :size="14" aria-hidden="true" />
        <span class="sr-only">{{ t('gallery.searchLocation') }}</span>
        <input ref="searchInput" v-model="query" type="search" role="searchbox" :aria-label="t('gallery.searchLocation')" :placeholder="t('gallery.searchLocationPlaceholder')" />
        <button v-if="query" type="button" class="clear-search" :aria-label="t('gallery.clearLocationSearch')" @click="query = ''"><X :size="13" aria-hidden="true" /></button>
      </label>
      <div class="location-options" role="listbox" :aria-label="t('gallery.locationHeading')">
        <button class="all-location" type="button" role="option" :aria-selected="selectedLocation === null" @click="selectLocation(null)">
          <span>{{ t('gallery.allLocations') }}</span>
          <Check v-if="selectedLocation === null" :size="14" aria-hidden="true" />
        </button>
        <section v-if="chinaOptions.length" class="location-section">
          <h3>{{ t('gallery.china') }}</h3>
          <button v-for="option in chinaOptions" :key="option.id" class="location-option" type="button" role="option" :disabled="!option.available" :aria-selected="selectedLocation === option.id" @click="selectLocation(option.id)">
            <span>{{ displayLocationLabel(option, locale) }}</span>
            <small v-if="option.available">{{ option.count }}</small>
            <Check v-if="selectedLocation === option.id" :size="14" aria-hidden="true" />
          </button>
        </section>
        <section v-if="otherOptions.length" class="location-section">
          <h3>{{ t('gallery.otherRegions') }}</h3>
          <button v-for="option in otherOptions" :key="option.id" class="location-option" type="button" role="option" :aria-selected="selectedLocation === option.id" @click="selectLocation(option.id)">
            <span>{{ displayLocationLabel(option, locale) }}</span>
            <small>{{ option.count }}</small>
            <Check v-if="selectedLocation === option.id" :size="14" aria-hidden="true" />
          </button>
        </section>
        <p v-if="!hasResults" class="location-empty">{{ t('gallery.noLocationResults') }}</p>
      </div>
    </div>
    </Teleport>
  </div>
</template>

<style scoped>
.location-picker { align-items: stretch; display: flex; height: 100%; position: relative; }
.location-trigger { align-items: center; align-self: stretch; background: transparent; border: 0; border-bottom: 2px solid transparent; border-radius: 0; color: var(--muted); display: inline-flex; font-family: Georgia, ui-serif, serif; font-size: 16px; gap: 7px; height: 100%; opacity: .6; padding: 0; white-space: nowrap; }
.location-trigger:hover, .location-trigger.active { border-bottom-color: var(--ink); color: var(--ink); opacity: 1; }
.location-chevron { margin-left: -2px; opacity: .65; transition: transform .18s ease; }
.location-trigger[aria-expanded='true'] .location-chevron { transform: rotate(180deg); }
.location-popover { background: color-mix(in srgb, var(--surface) 98%, var(--paper)); border: 1px solid var(--line); border-radius: 8px; box-shadow: var(--shadow); color: var(--ink); display: grid; gap: 12px; grid-template-rows: auto auto minmax(0, 1fr); max-height: calc(100vh - 32px); padding: 14px; position: fixed; width: min(350px, calc(100vw - 32px)); z-index: 50; }
.location-popover-head { align-items: center; display: flex; justify-content: space-between; }
.location-popover-head strong { font-family: Georgia, ui-serif, serif; font-size: 15px; font-weight: 500; }
.location-close, .clear-search { align-items: center; background: transparent; border: 0; color: var(--muted); display: inline-flex; justify-content: center; padding: 3px; }
.location-close:hover, .clear-search:hover { color: var(--ink); }
.location-search { align-items: center; background: var(--surface-soft); border: 1px solid var(--line); border-radius: 5px; color: var(--muted); display: flex; gap: 7px; padding: 8px 9px; }
.location-search:focus-within { border-color: var(--ink); color: var(--ink); }
.location-search input { background: transparent; border: 0; color: var(--ink); font: inherit; font-size: 12px; min-width: 0; outline: 0; width: 100%; }
.location-options { max-height: min(54vh, 390px); overflow-y: auto; padding-right: 2px; }
.all-location, .location-option { align-items: center; background: transparent; border: 0; border-radius: 5px; color: var(--muted); display: flex; font-size: 12px; gap: 8px; justify-content: space-between; min-height: 32px; padding: 7px 8px; text-align: left; width: 100%; }
.all-location { color: var(--ink); font-weight: 600; margin-bottom: 8px; }
.all-location:hover, .location-option:not(:disabled):hover, .location-option[aria-selected='true'] { background: var(--surface-soft); color: var(--ink); }
.location-section { border-top: 1px solid var(--line); display: grid; gap: 2px 4px; grid-template-columns: repeat(auto-fill, minmax(98px, 1fr)); padding-top: 9px; }
.location-section + .location-section { margin-top: 8px; }
.location-section h3 { color: var(--muted); font-size: 10px; font-weight: 700; grid-column: 1 / -1; letter-spacing: .08em; margin: 0 8px 4px; text-transform: uppercase; }
.location-option:disabled { cursor: not-allowed; opacity: .34; }
.location-option { min-width: 0; }
.location-option span { min-width: 0; overflow-wrap: anywhere; }
.location-option small { color: var(--muted); font-size: 10px; margin-left: auto; }
.location-option svg { color: var(--accent-deep); flex: 0 0 auto; }
.location-empty { color: var(--muted); font-size: 12px; margin: 12px 8px 8px; text-align: center; }
@media (max-width: 580px) {
  .location-trigger { font-size: 15px; }
  .location-popover { max-width: calc(100vw - 32px); }
}
</style>
