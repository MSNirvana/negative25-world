<script setup lang="ts">
import { ArrowLeft, ExternalLink, Instagram, LoaderCircle } from 'lucide-vue-next';
import { onMounted, ref } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { fetchPublicProfile, type PublicProfile } from '../api/client';
import { useLocale } from '../i18n';

const route = useRoute();
const { t } = useLocale();
const profile = ref<PublicProfile | null>(null);
const loading = ref(true);
const error = ref(false);

onMounted(async () => {
  const username = String(route.params.username ?? '').replace(/^@/, '');
  try { profile.value = await fetchPublicProfile(username); } catch { error.value = true; } finally { loading.value = false; }
});
</script>

<template>
  <main class="public-profile page-frame">
    <div v-if="loading" class="profile-state"><LoaderCircle :size="16" class="spin" /> {{ t('publicProfile.loading') }}</div>
    <section v-else-if="profile" class="profile-content">
      <div class="profile-avatar"><span>{{ (profile.displayName || profile.username).slice(0, 1).toUpperCase() }}</span></div>
      <span class="eyebrow">negative25 / @{{ profile.username }}</span>
      <h1>{{ profile.displayName || `@${profile.username}` }}</h1>
      <p v-if="profile.bio" class="bio">{{ profile.bio }}</p>
      <p v-if="profile.location" class="location">{{ profile.location }}</p>
      <div class="links"><a v-if="profile.websiteUrl" :href="profile.websiteUrl" target="_blank" rel="noreferrer"><ExternalLink :size="14" /> {{ t('publicProfile.website') }}</a><a v-if="profile.instagramUrl" :href="profile.instagramUrl" target="_blank" rel="noreferrer"><Instagram :size="14" /> Instagram</a><a v-if="profile.weiboUrl" :href="profile.weiboUrl" target="_blank" rel="noreferrer">Weibo</a></div>
      <section v-if="profile.photos.length" class="public-work"><div class="work-heading"><span class="eyebrow">{{ t('publicProfile.photos') }}</span><span class="muted">{{ t('gallery.count', { count: profile.photos.length }) }}</span></div><div class="public-grid"><article v-for="photo in profile.photos" :key="photo.id"><img :src="photo.thumbnail.url" :alt="photo.title || profile.username" loading="lazy" /><p>{{ photo.title || profile.username }}</p></article></div></section>
    </section>
    <section v-else class="profile-state error-state"><p>{{ t('publicProfile.notFound') }}</p><RouterLink to="/"><ArrowLeft :size="15" /> {{ t('publicProfile.backHome') }}</RouterLink></section>
  </main>
</template>

<style scoped>
.public-profile { min-height: calc(100vh - 140px); min-height: calc(100dvh - 140px); padding-bottom: calc(100px + env(safe-area-inset-bottom)); padding-top: 120px; }.profile-content { max-width: 900px; }.profile-avatar { align-items: center; background: var(--surface-soft); border-radius: 50%; color: var(--accent-deep); display: flex; font-size: 28px; font-weight: 650; height: 76px; justify-content: center; margin-bottom: 28px; width: 76px; }.profile-content h1 { font-size: clamp(42px, 7vw, 76px); letter-spacing: -.05em; margin: 12px 0 16px; overflow-wrap: anywhere; }.bio { color: var(--muted); font-size: 17px; line-height: 1.6; margin: 0 0 12px; max-width: 540px; overflow-wrap: anywhere; }.location { color: var(--muted); font-size: 13px; margin: 0; }.links { display: flex; flex-wrap: wrap; gap: 18px; margin-top: 30px; }.links a { align-items: center; display: inline-flex; font-size: 12px; gap: 6px; min-height: 40px; }.links a:hover { color: var(--accent-deep); }.public-work { border-top: 1px solid var(--line); margin-top: 58px; padding-top: 18px; }.work-heading { align-items: flex-end; display: flex; justify-content: space-between; margin-bottom: 16px; }.work-heading .muted { font-size: 11px; }.public-grid { display: grid; gap: 14px; grid-template-columns: repeat(3, minmax(0, 1fr)); }.public-grid article { margin: 0; }.public-grid img { aspect-ratio: 1.4; background: var(--surface-soft); display: block; height: auto; object-fit: cover; width: 100%; }.public-grid p { color: var(--muted); font-size: 11px; margin: 8px 0 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.profile-state { align-items: center; color: var(--muted); display: flex; font-size: 13px; gap: 8px; justify-content: center; min-height: 300px; }.error-state { flex-direction: column; }.error-state p { margin: 0; }.error-state a { align-items: center; display: inline-flex; font-size: 12px; gap: 6px; min-height: 40px; }.spin { animation: spin 1s linear infinite; }@keyframes spin { to { transform: rotate(360deg); } }
@media (max-width: 680px) { .public-profile { padding-top: 76px; }.public-grid { gap: 8px; grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style>
