<script setup lang="ts">
import { computed, nextTick, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowUp } from 'lucide-vue-next';
import PhotoGrid from '../components/PhotoGrid.vue';
import AlbumStacks from '../components/AlbumStacks.vue';
import LoadingState from '../components/LoadingState.vue';
import ErrorState from '../components/ErrorState.vue';
import { fetchAlbum, fetchAlbums, isApiConfigured } from '../api/client';
import { useGalleryStore, type GalleryMode } from '../stores/gallery';
import { useLocale } from '../i18n';
import { useSessionStore } from '../stores/session';
import { useWorkspaceStore } from '../stores/workspace';
import { usePublicViewerStore } from '../stores/public-viewer';
import type { AlbumDetail } from '@negative25/contracts';
import { photoReturnQuery } from '../lib/photo-return';
import { consumeGalleryScroll, rememberGalleryScroll, restoreGalleryScroll } from '../lib/gallery-scroll';

defineOptions({ name: 'GalleryView' });

const route = useRoute();
const router = useRouter();
const gallery = useGalleryStore();
const session = useSessionStore();
const workspace = useWorkspaceStore();
const publicViewer = usePublicViewerStore();
const { t } = useLocale();
const loadSentinel = ref<HTMLElement | null>(null);
let loadObserver: IntersectionObserver | null = null;
const albums = ref<AlbumDetail[]>([]);
const albumsLoading = ref(false);
const albumsError = ref<string | null>(null);
const expandedAlbumId = ref<string | null>(null);
let albumRequestId = 0;
let contextRequestId = 0;
let hasActivated = false;
let deactivatedForPhoto = false;
let photoViewerOpen = false;
const showBackToTop = ref(false);
const modeLabels: Record<GalleryMode, string> = { featured: 'gallery.featuredHeading', recent: 'gallery.recentHeading', shuffle: 'gallery.shuffleHeading', location: 'gallery.locationHeading', nearby: 'gallery.nearbyHeading', faraway: 'gallery.farawayHeading' };
const heading = computed(() => t(modeLabels[gallery.mode]));
const contextReady = ref(false);

function markContextReady(): void {
  contextReady.value = true;
  void gallery.loadLocationCatalog();
}

async function syncGalleryContext(): Promise<void> {
  const requestId = ++contextRequestId;
  contextReady.value = false;
  await session.loadUser();
  if (requestId !== contextRequestId) return;
  const viewingUsername = typeof route.query.user === 'string' ? route.query.user : null;
  const requestedSpace = typeof route.query.space === 'string' && route.query.space.trim()
    ? route.query.space.trim()
    : null;
  if (viewingUsername) {
    const profile = await publicViewer.load(viewingUsername);
    if (requestId !== contextRequestId) return;
    gallery.setContext(profile?.workspaceSlug ?? 'primary', null);
    markContextReady();
    return;
  }
  publicViewer.clear();
  if (requestedSpace) {
    let token: string | null = null;
    if (requestedSpace !== 'primary' && session.accessToken) {
      await workspace.load(session.accessToken);
      if (requestId !== contextRequestId) return;
      if (workspace.spaces.some((item) => item.slug === requestedSpace)) token = session.accessToken;
    }
    gallery.setContext(requestedSpace, token, { preserveExistingToken: requestedSpace === gallery.spaceSlug });
    markContextReady();
    return;
  }
  if (session.authenticated) {
    await workspace.load(session.accessToken);
    if (requestId !== contextRequestId) return;
    gallery.setContext(workspace.slug, session.accessToken);
  } else {
    gallery.setContext('primary', null);
  }
  markContextReady();
}
watch(() => [route.query.mode, route.query.location], ([mode, location]) => {
  const requestedMode = typeof mode === 'string' && mode in modeLabels ? mode as GalleryMode : 'featured';
  const nextMode = requestedMode === 'nearby' ? 'location' : requestedMode;
  if (gallery.mode !== nextMode) gallery.setMode(nextMode);
  gallery.setLocation(nextMode === 'location' && typeof location === 'string' ? location : null);
}, { immediate: true });
async function loadAlbums(): Promise<void> {
  if (!isApiConfigured()) { albums.value = []; return; }
  const requestId = ++albumRequestId;
  albumsLoading.value = true;
  albumsError.value = null;
  expandedAlbumId.value = null;
  try {
    const summaries = await fetchAlbums(gallery.spaceSlug);
    const details = await Promise.all(summaries.map((album) => fetchAlbum(gallery.spaceSlug, album.id)));
    if (requestId === albumRequestId) albums.value = details;
  } catch (cause) {
    if (requestId === albumRequestId) {
      albums.value = [];
      albumsError.value = cause instanceof Error ? cause.message : t('albums.error');
    }
  } finally { if (requestId === albumRequestId) albumsLoading.value = false; }
}
watch(() => [gallery.mode, gallery.selectedLocation, contextReady.value, gallery.spaceSlug, gallery.shuffleSeed] as const, ([mode, , ready]) => {
  if (!ready) return;
  if (mode === 'faraway') { void loadAlbums(); return; }
  expandedAlbumId.value = null;
  void gallery.load(mode as GalleryMode);
}, { immediate: true });
watch(() => workspace.slug, () => { if (contextReady.value && session.authenticated) { gallery.setContext(workspace.slug, session.accessToken); void gallery.loadLocationCatalog(); void gallery.load(gallery.mode); } });
watch(() => [session.authenticated, route.query.user, route.query.space], () => {
  // A fixed photo viewer carries its own workspace query. Do not let that
  // query replace the cached gallery page while the viewer is open or while
  // the gallery is being reactivated after closing it.
  if (!photoViewerOpen && !deactivatedForPhoto && !route.path.startsWith('/photo/')) void syncGalleryContext();
});
function open(photo: Parameters<typeof gallery.openPhoto>[0]): void {
  gallery.openPhoto(photo, gallery.visiblePhotos);
  photoViewerOpen = true;
  rememberGalleryScroll(route.fullPath, typeof window === 'undefined' ? 0 : window.scrollY);
  void router.push({ path: `/photo/${photo.id}`, query: { ...route.query, space: gallery.spaceSlug, ...photoReturnQuery(route.fullPath) } });
}
function loadMore(): void { if (!gallery.nextCursor || gallery.loading) return; void gallery.load(gallery.mode, true); }
function openAlbumPhoto(photo: Parameters<typeof gallery.openPhoto>[0]): void { open(photo); }
function observeSentinel(): void {
  if (!loadSentinel.value || !loadObserver) return;
  loadObserver.unobserve(loadSentinel.value);
  loadObserver.observe(loadSentinel.value);
}
function updateBackToTop(): void {
  if (typeof window === 'undefined') return;
  showBackToTop.value = window.scrollY > Math.max(window.innerHeight * 0.65, 360);
}
function scrollToTop(): void {
  if (typeof window !== 'undefined') window.scrollTo({ left: 0, top: 0, behavior: 'smooth' });
}
onMounted(() => {
  void syncGalleryContext();
  updateBackToTop();
  window.addEventListener('scroll', updateBackToTop, { passive: true });
  if (typeof IntersectionObserver === 'undefined') return;
  loadObserver = new IntersectionObserver((entries) => { if (entries.some((entry) => entry.isIntersecting)) loadMore(); }, { rootMargin: '0px 0px 1600px', threshold: 0.01 });
  observeSentinel();
});
onActivated(() => {
  // GalleryView is kept alive while the account area is open. Re-sync the
  // active workspace on return so the cached view cannot remain empty/stale.
  const returningFromPhoto = photoViewerOpen || deactivatedForPhoto;
  if (hasActivated && !returningFromPhoto) void syncGalleryContext();
  if (returningFromPhoto) {
    restoreGalleryScroll(consumeGalleryScroll(route.fullPath));
    // Keep the guard for one tick so route-query watchers cannot issue a
    // fresh first-page load between reactivation and scroll restoration.
    void nextTick(() => { deactivatedForPhoto = false; photoViewerOpen = false; });
  }
  hasActivated = true;
});
onDeactivated(() => { deactivatedForPhoto = route.path.startsWith('/photo/'); });
watch(() => gallery.nextCursor, () => void nextTick(observeSentinel));
onBeforeUnmount(() => {
  contextRequestId += 1;
  loadObserver?.disconnect();
  window.removeEventListener('scroll', updateBackToTop);
});
</script>

<template>
  <main class="gallery-page">
    <section class="gallery-content page-frame">
      <h1 class="sr-only">{{ heading }}</h1>
      <template v-if="gallery.mode === 'faraway'">
        <ErrorState v-if="albumsError" :message="albumsError" />
        <LoadingState v-else-if="albumsLoading" />
        <div v-else-if="!albums.length" class="empty-state">{{ t('albums.empty') }}</div>
        <AlbumStacks v-else :albums="albums" :expanded-album-id="expandedAlbumId" @expand="expandedAlbumId = $event" @collapse="expandedAlbumId = null" @open-photo="openAlbumPhoto" />
      </template>
      <template v-else>
        <ErrorState v-if="gallery.error && !gallery.visiblePhotos.length" :message="gallery.error" />
        <LoadingState v-else-if="gallery.loading && !gallery.visiblePhotos.length" />
        <div v-else-if="!gallery.visiblePhotos.length" class="empty-state">{{ t('gallery.empty') }}</div>
        <PhotoGrid v-else :photos="gallery.visiblePhotos" @open="open" />
      </template>
      <div v-if="gallery.mode !== 'faraway' && (gallery.nextCursor || (gallery.loading && gallery.visiblePhotos.length))" ref="loadSentinel" class="gallery-sentinel" aria-live="polite">
        <span v-if="gallery.loading">{{ t('gallery.loadingMore') }}</span>
        <template v-else-if="gallery.error"><span>{{ gallery.error }}</span><button type="button" @click="loadMore">{{ t('gallery.retry') }}</button></template>
      </div>
    </section>
    <button v-if="showBackToTop" class="back-to-top" type="button" :aria-label="t('gallery.backToTop')" :title="t('gallery.backToTop')" @click="scrollToTop"><ArrowUp :size="17" stroke-width="2" /></button>
  </main>
</template>

<style scoped>
.gallery-page { min-height: 100vh; min-height: 100dvh; padding-bottom: calc(86px + env(safe-area-inset-bottom)); }
.gallery-content { margin-top: 24px; max-width: none; padding-left: 40px; padding-right: 40px; width: 100%; }
.empty-state { border-top: 1px solid var(--line); color: var(--muted); padding: 72px 0; text-align: center; }
.gallery-sentinel { align-items: center; color: var(--muted); display: flex; font-size: 11px; gap: 12px; justify-content: center; min-height: 64px; padding: 12px 20px; }
.gallery-sentinel button { background: transparent; border: 1px solid var(--line); border-radius: 999px; color: inherit; font-size: 11px; padding: 7px 12px; }
.gallery-sentinel button:hover { border-color: var(--ink); color: var(--ink); }
.back-to-top { align-items: center; background: color-mix(in srgb, var(--surface) 88%, transparent); border: 1px solid var(--line); border-radius: 50%; bottom: calc(24px + env(safe-area-inset-bottom)); box-shadow: 0 8px 22px color-mix(in srgb, var(--ink) 12%, transparent); color: var(--ink); display: inline-flex; height: 38px; justify-content: center; position: fixed; right: 24px; transition: background .2s ease, border-color .2s ease, transform .2s ease; width: 38px; z-index: 12; }
.back-to-top:hover { background: var(--surface); border-color: var(--ink); transform: translateY(-2px); }
@media (max-width: 1180px) { .gallery-content { padding-left: 28px; padding-right: 28px; } }
@media (max-width: 580px) { .gallery-content { margin-top: 17px; padding-left: 16px; padding-right: 16px; } .back-to-top { bottom: calc(18px + env(safe-area-inset-bottom)); right: 16px; } }
</style>
