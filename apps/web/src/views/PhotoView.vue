<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import PhotoViewer from '../components/PhotoViewer.vue';
import { useGalleryStore } from '../stores/gallery';
import { useLocale } from '../i18n';
import { photoReturnTarget } from '../lib/photo-return';
import { usePublicViewerStore } from '../stores/public-viewer';

const props = defineProps<{ id: string }>();
const router = useRouter();
const route = useRoute();
const gallery = useGalleryStore();
const publicViewer = usePublicViewerStore();
const { t } = useLocale();
const photo = computed(() => gallery.photos.find((item) => item.id === props.id) ?? null);
const previous = computed(() => { if (!photo.value) return null; const index = gallery.visiblePhotos.findIndex((item) => item.id === photo.value?.id); return index > 0 ? gallery.visiblePhotos[index - 1] : null; });
const next = computed(() => { if (!photo.value) return null; const index = gallery.visiblePhotos.findIndex((item) => item.id === photo.value?.id); return index >= 0 ? gallery.visiblePhotos[index + 1] ?? null : null; });
onMounted(async () => {
  const username = typeof route.query.user === 'string' ? route.query.user : null;
  const profile = username ? await publicViewer.load(username) : null;
  if (profile?.workspaceSlug) gallery.setContext(profile.workspaceSlug, null);
  if (!photo.value) void gallery.loadPhoto(props.id);
});
function close(): void {
  const returnTo = photoReturnTarget(route.query.returnTo);
  if (returnTo) { void router.replace(returnTo); return; }
  void router.push({ path: '/', query: { mode: gallery.mode, ...(route.query.user ? { user: route.query.user } : {}) } });
}
function photoQuery(): { returnTo?: string } {
  const returnTo = photoReturnTarget(route.query.returnTo);
  return { ...(route.query.user ? { user: String(route.query.user) } : {}), ...(returnTo ? { returnTo } : {}) };
}
function goPrevious(): void { if (previous.value) void router.replace({ name: 'photo', params: { id: previous.value.id }, query: photoQuery() }); }
function goNext(): void { if (next.value) void router.replace({ name: 'photo', params: { id: next.value.id }, query: photoQuery() }); }
</script>

<template>
  <PhotoViewer v-if="photo" :photo="photo" :previous="previous" :next="next" @close="close" @previous="goPrevious" @next="goNext" />
  <main v-else-if="gallery.loading" class="not-found page-frame"><span class="eyebrow">{{ t('photo.loading') }}</span><h1>{{ t('photo.loading') }}</h1></main>
  <main v-else class="not-found page-frame"><span class="eyebrow">404</span><h1>{{ t('photo.notFound') }}</h1><button @click="close">{{ t('photo.backGallery') }}</button></main>
</template>

<style scoped>.not-found { padding: 120px 0; position: relative; }.not-found h1 { font-size: 42px; letter-spacing: -.04em; }.not-found button { background: var(--ink); border-radius: 4px; color: var(--paper); padding: 10px 15px; }</style>
