<script setup lang="ts">
import { Shuffle, Sparkles, Clock3, LocateFixed, Images } from 'lucide-vue-next';
import type { GalleryMode, GalleryPhoto } from '../stores/gallery';
import { useLocale } from '../i18n';
import LocationPicker from './LocationPicker.vue';
const props = defineProps<{ active: GalleryMode; inline?: boolean; photos?: readonly GalleryPhoto[]; selectedLocation?: string | null }>();
const emit = defineEmits<{
  (event: 'select', value: GalleryMode): void;
  (event: 'select-location', value: string | null): void;
}>();
const { t } = useLocale();
const items: { value: GalleryMode; key: string; icon: typeof Sparkles }[] = [
  { value: 'featured', key: 'gallery.featured', icon: Sparkles },
  { value: 'recent', key: 'gallery.recent', icon: Clock3 },
  { value: 'shuffle', key: 'gallery.shuffle', icon: Shuffle },
  { value: 'location', key: 'gallery.region', icon: LocateFixed },
  { value: 'faraway', key: 'gallery.faraway', icon: Images },
];
</script>

<template>
  <div class="category-bar" :class="{ 'is-inline': inline }">
    <nav class="category-nav" :aria-label="t('gallery.modes')">
      <template v-for="item in items" :key="item.value">
        <LocationPicker v-if="item.value === 'location'" :active="active === 'location'" :photos="props.photos ?? []" :selected-location="props.selectedLocation ?? null" @select-location="emit('select-location', $event)" />
        <button v-else type="button" :class="{ active: active === item.value }" @click="emit('select', item.value)">
          <component :is="item.icon" :size="14" /> {{ t(item.key) }}
        </button>
      </template>
    </nav>
  </div>
</template>

<style scoped>
.category-bar { backdrop-filter: blur(14px); background: color-mix(in srgb, var(--paper) 84%, transparent); border-bottom: 1px solid var(--line); position: sticky; top: 0; z-index: 8; }
.category-nav { display: flex; gap: 25px; height: var(--bar-height); margin: 0; max-width: none; overflow-x: auto; padding-left: 40px; padding-right: 40px; scrollbar-width: none; width: 100%; }
.category-bar.is-inline { backdrop-filter: none; background: transparent; border-bottom: 0; position: static; }
.category-bar.is-inline .category-nav { gap: 22px; height: var(--header-height); max-width: 100%; overflow: visible; padding-left: 0; padding-right: 0; width: auto; }
.category-nav::-webkit-scrollbar { display: none; }
button { align-items: center; background: transparent; border-radius: 0; border-bottom: 2px solid transparent; color: var(--muted); display: inline-flex; flex: 0 0 auto; font-family: Georgia, ui-serif, serif; font-size: 16px; gap: 7px; opacity: .6; padding: 0; }
button:hover { color: var(--ink); opacity: .86; }
button.active { border-bottom-color: var(--ink); color: var(--ink); opacity: 1; }
@media (max-width: 1180px) { .category-nav { padding-left: 28px; padding-right: 28px; width: 100%; } }
@media (max-width: 580px) {
  .category-nav { gap: 23px; height: 48px; padding-left: 16px; padding-right: 16px; }
  .category-bar.is-inline .category-nav { gap: 23px; height: 48px; overflow-x: auto; overflow-y: visible; padding-left: 0; padding-right: 16px; scroll-padding-inline: 0 16px; width: 100%; }
  button { font-size: 15px; }
}
</style>
