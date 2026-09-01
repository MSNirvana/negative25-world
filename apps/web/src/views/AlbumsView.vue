<script setup lang="ts">
import { FolderOpen, LoaderCircle } from 'lucide-vue-next';
import { onMounted, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import { fetchAlbums, isApiConfigured } from '../api/client';
import type { AlbumSummary } from '@negative25/contracts';
import PublicFooter from '../components/PublicFooter.vue';
import { useLocale } from '../i18n';
import { useRoute } from 'vue-router';
import { usePublicViewerStore } from '../stores/public-viewer';

const albums = ref<AlbumSummary[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const { t } = useLocale();
const route = useRoute();
const publicViewer = usePublicViewerStore();

async function load(): Promise<void> {
  if (!isApiConfigured()) return;
  loading.value = true;
  error.value = null;
  try {
    const username = typeof route.query.user === 'string' ? route.query.user : null;
    const profile = username ? await publicViewer.load(username) : null;
    albums.value = await fetchAlbums(profile?.workspaceSlug ?? 'primary');
  } catch (cause) { error.value = cause instanceof Error ? cause.message : t('albums.error'); } finally { loading.value = false; }
}
onMounted(load);
watch(() => route.query.user, load);
</script>

<template>
  <main class="albums-page page-frame">
    <section class="albums-heading"><div><span class="eyebrow">{{ t('albums.eyebrow') }}</span><h1>{{ t('albums.title') }}</h1><p>{{ t('albums.description') }}</p></div></section>
    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    <div v-if="loading" class="empty-state"><LoaderCircle :size="16" class="spin" /> {{ t('album.loading') }}...</div>
    <div v-else-if="!albums.length" class="empty-state"><FolderOpen :size="18" /> {{ t('albums.empty') }}</div>
    <section v-else class="album-grid" :aria-label="t('albums.photoAlbums')">
      <RouterLink v-for="album in albums" :key="album.id" class="album-card" :to="{ path: `/album/${album.id}`, query: route.query }">
        <div class="album-cover" :style="album.cover ? { aspectRatio: album.cover.aspectRatio, backgroundImage: `url(${album.cover.thumbnail.url})` } : undefined"><FolderOpen v-if="!album.cover" :size="22" /></div>
        <div class="album-copy"><div><h2>{{ album.title }}</h2><p v-if="album.description">{{ album.description }}</p><time v-if="album.shootDate" :datetime="album.shootDate">{{ album.shootDate }}</time></div><span>{{ t('albums.count', { count: album.photoCount }) }}</span></div>
      </RouterLink>
    </section>
    <PublicFooter />
  </main>
</template>

<style scoped>
.albums-page { padding-bottom: 70px; }.albums-heading { padding: 62px 0 42px; }.albums-heading h1 { font-family: Georgia, ui-serif, serif; font-size: clamp(38px, 5vw, 60px); font-weight: 500; letter-spacing: -.04em; margin: 13px 0 10px; }.albums-heading p { color: var(--muted); margin: 0; }.album-grid { display: grid; gap: 38px 32px; grid-template-columns: repeat(3, minmax(0, 1fr)); }.album-card { display: grid; gap: 13px; min-width: 0; }.album-card:hover h2 { color: var(--ink); }.album-cover { align-items: center; background: var(--surface-soft) center / cover no-repeat; color: var(--muted); display: flex; justify-content: center; min-height: 180px; }.album-copy { align-items: flex-start; display: flex; gap: 14px; justify-content: space-between; }.album-copy h2 { font-family: Georgia, ui-serif, serif; font-size: 18px; font-weight: 500; margin: 0; }.album-copy p { color: var(--muted); font-size: 12px; line-height: 1.45; margin: 6px 0 0; }.album-copy time { color: var(--muted); display: block; font-size: 11px; margin-top: 7px; }.album-copy > span { color: var(--muted); flex: 0 0 auto; font-size: 11px; padding-top: 3px; }.empty-state { align-items: center; border-top: 1px solid var(--line); color: var(--muted); display: flex; gap: 8px; justify-content: center; padding: 72px 0; }.form-error { color: #d38c80; font-size: 12px; margin: 0 0 24px; }.spin { animation: spin 1s linear infinite; }@keyframes spin { to { transform: rotate(360deg); } }
@media (max-width: 960px) { .album-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 580px) { .albums-heading { padding: 42px 0 32px; }.album-grid { gap: 30px 14px; grid-template-columns: 1fr; }.album-cover { min-height: 220px; } }
</style>
