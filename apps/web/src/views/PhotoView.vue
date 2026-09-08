<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import PhotoViewer from '../components/PhotoViewer.vue';
import { useGalleryStore } from '../stores/gallery';
import { useLocale } from '../i18n';
import { photoReturnTarget } from '../lib/photo-return';
import { usePublicViewerStore } from '../stores/public-viewer';
import { useSessionStore } from '../stores/session';
import { useWorkspaceStore } from '../stores/workspace';

const props = defineProps<{ id: string }>();
const router = useRouter();
const route = useRoute();
const gallery = useGalleryStore();
const publicViewer = usePublicViewerStore();
const session = useSessionStore();
const workspace = useWorkspaceStore();
const { t } = useLocale();
const photo = computed(() => gallery.findPhoto(props.id));
const previous = computed(() => { if (!photo.value) return null; const index = gallery.visiblePhotos.findIndex((item) => item.id === photo.value?.id); return index > 0 ? gallery.visiblePhotos[index - 1] : null; });
const next = computed(() => { if (!photo.value) return null; const index = gallery.visiblePhotos.findIndex((item) => item.id === photo.value?.id); return index >= 0 ? gallery.visiblePhotos[index + 1] ?? null : null; });
const photoLoading = ref(true);
let photoRequestId = 0;
let activePhotoRequest: AbortController | null = null;

async function syncPhoto(): Promise<void> {
  const requestId = ++photoRequestId;
  activePhotoRequest?.abort();
  const controller = new AbortController();
  activePhotoRequest = controller;
  photoLoading.value = true;
  const isCurrentRequest = (): boolean => !controller.signal.aborted && requestId === photoRequestId;
  const username = typeof route.query.user === 'string' ? route.query.user : null;
  const profile = username ? await publicViewer.load(username) : null;
  if (!isCurrentRequest()) return;
  const requestedSpace = typeof route.query.space === 'string' && route.query.space.trim()
    ? route.query.space.trim()
    : null;
  // Public profile context is authoritative. Direct links without a profile
  // use the workspace carried by the link instead of a primary fallback.
  if (username) {
    // A username is authoritative. Do not fall back to a stale workspace if
    // the public profile cannot be resolved.
    if (!profile?.workspaceSlug) {
      gallery.setContext('primary', null);
      photoLoading.value = false;
      return;
    }
    gallery.setContext(profile.workspaceSlug, null);
  } else if (requestedSpace) {
    // Only send an authenticated request for a workspace the current account
    // actually belongs to. Public links opened while signed in must remain
    // readable instead of being rejected by another workspace's ACL.
    let token: string | null = null;
    if (requestedSpace !== 'primary' && session.accessToken) {
      await workspace.load(session.accessToken);
      if (workspace.spaces.some((item) => item.slug === requestedSpace)) token = session.accessToken;
    }
    gallery.setContext(requestedSpace, token);
  }
  if (!isCurrentRequest()) return;
  if (photo.value) {
    photoLoading.value = false;
    if (activePhotoRequest === controller) activePhotoRequest = null;
    return;
  }
  await gallery.loadPhoto(props.id, controller.signal);
  if (isCurrentRequest()) photoLoading.value = false;
  if (activePhotoRequest === controller) activePhotoRequest = null;
}

watch(() => [props.id, route.query.user, route.query.space] as const, () => { void syncPhoto(); }, { immediate: true });
onBeforeUnmount(() => {
  photoRequestId += 1;
  activePhotoRequest?.abort();
});
function close(): void {
  const returnTo = photoReturnTarget(route.query.returnTo);
  if (returnTo) { void router.replace(returnTo); return; }
  void router.push({ path: '/', query: {
    mode: gallery.mode,
    ...(route.query.user ? { user: route.query.user } : {}),
    ...(route.query.space ? { space: String(route.query.space) } : {}),
  } });
}
function photoQuery(): { returnTo?: string } {
  const returnTo = photoReturnTarget(route.query.returnTo);
  return {
    ...(route.query.user ? { user: String(route.query.user) } : {}),
    ...(route.query.space ? { space: String(route.query.space) } : {}),
    ...(returnTo ? { returnTo } : {}),
  };
}
function goPrevious(): void { if (previous.value) void router.replace({ name: 'photo', params: { id: previous.value.id }, query: photoQuery() }); }
function goNext(): void { if (next.value) void router.replace({ name: 'photo', params: { id: next.value.id }, query: photoQuery() }); }
</script>

<template>
  <PhotoViewer v-if="photo" :photo="photo" :previous="previous" :next="next" @close="close" @previous="goPrevious" @next="goNext" />
  <main v-else-if="photoLoading" class="not-found page-frame"><span class="eyebrow">{{ t('photo.loading') }}</span><h1>{{ t('photo.loading') }}</h1></main>
  <main v-else class="not-found page-frame"><span class="eyebrow">404</span><h1>{{ t('photo.notFound') }}</h1><button @click="close">{{ t('photo.backGallery') }}</button></main>
</template>

<style scoped>.not-found { padding: 120px 0; position: relative; }.not-found h1 { font-size: 42px; letter-spacing: -.04em; }.not-found button { background: var(--ink); border-radius: 4px; color: var(--paper); padding: 10px 15px; }</style>
