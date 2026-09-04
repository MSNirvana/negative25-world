<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { Search } from 'lucide-vue-next';
import BrandMark from './BrandMark.vue';
import CategoryNav from './CategoryNav.vue';
import LanguageSwitcher from './LanguageSwitcher.vue';
import ThemeSwitcher from './ThemeSwitcher.vue';
import { useLocale } from '../i18n';
import { useGalleryStore, type GalleryMode } from '../stores/gallery';
import { searchPublicUsers } from '../api/client';
import type { PublicProfileSearchResult } from '@negative25/contracts';
import { usePublicViewerStore } from '../stores/public-viewer';

const router = useRouter();
const route = useRoute();
const isDiscover = computed(() => route.path.startsWith('/discover'));
const isGallery = computed(() => route.path === '/');
const activeMenu = ref<string | null>(null);
const navRoot = ref<HTMLElement | null>(null);
const gallery = useGalleryStore();
const publicViewer = usePublicViewerStore();
const { t } = useLocale();
const userQuery = ref('');
const userResults = ref<PublicProfileSearchResult[]>([]);
const userSearchLoading = ref(false);
const userSearchError = ref(false);
let userSearchTimer: number | undefined;
function toggleMenu(menu: string): void { activeMenu.value = activeMenu.value === menu ? null : menu; }
function closeMenu(event: MouseEvent): void { if (navRoot.value && !navRoot.value.contains(event.target as Node)) activeMenu.value = null; }
function selectMode(mode: GalleryMode): void {
  gallery.setMode(mode);
  if (mode !== 'location') gallery.setLocation(null);
  void router.replace({ query: { ...route.query, mode, ...(mode === 'location' ? {} : { location: undefined }) } });
}
function selectLocation(location: string | null): void {
  gallery.setMode('location');
  gallery.setLocation(location);
  void router.replace({ query: { ...route.query, mode: 'location', ...(location ? { location } : { location: undefined }) } });
}
function searchUsers(): void {
  if (userSearchTimer !== undefined) window.clearTimeout(userSearchTimer);
  const query = userQuery.value.trim();
  userResults.value = [];
  userSearchError.value = false;
  if (!query) { userSearchLoading.value = false; return; }
  userSearchLoading.value = true;
  userSearchTimer = window.setTimeout(async () => {
    try { userResults.value = await searchPublicUsers(query); } catch { userSearchError.value = true; } finally { userSearchLoading.value = false; }
  }, 220);
}
function openUserProfile(username: string): void { activeMenu.value = null; userQuery.value = ''; userResults.value = []; void router.push({ path: '/', query: { user: username } }); }
function exitPublicViewer(): void { publicViewer.clear(); void router.push({ path: '/', query: {} }); }
onMounted(() => window.addEventListener('click', closeMenu));
onBeforeUnmount(() => { window.removeEventListener('click', closeMenu); if (userSearchTimer !== undefined) window.clearTimeout(userSearchTimer); });
</script>

<template>
  <header class="header" :class="{ 'header-map': isDiscover }">
    <div class="header-inner">
      <div class="header-start">
        <button class="brand" :aria-label="t('header.home')" @click="router.push({ path: '/', query: route.query })"><BrandMark /></button>
        <CategoryNav v-if="isGallery" inline :active="gallery.mode" :photos="gallery.locationPhotos" :selected-location="gallery.selectedLocation" @select="selectMode" @select-location="selectLocation" />
        <button v-if="route.query.user" class="viewer-chip" type="button" @click="exitPublicViewer">@{{ route.query.user }} <span aria-hidden="true">×</span></button>
      </div>
      <nav ref="navRoot" class="utility-nav" :aria-label="t('header.siteLinks')">
        <div class="menu-item"><button :aria-expanded="activeMenu === 'users'" @click.stop="toggleMenu('users')"><Search :size="14" /> {{ t('header.searchUsers') }}</button><div v-if="activeMenu === 'users'" class="menu-popover user-search-popover"><form @submit.prevent="searchUsers"><label class="user-search-field"><Search :size="14" /><input v-model="userQuery" :placeholder="t('header.searchUsersPlaceholder')" :aria-label="t('header.searchUsers')" @input="searchUsers" /></label></form><p v-if="userSearchLoading" class="search-status">{{ t('header.searchUsersLoading') }}</p><p v-else-if="userSearchError" class="search-status">{{ t('header.searchUsersEmpty') }}</p><p v-else-if="userQuery.trim() && !userResults.length" class="search-status">{{ t('header.searchUsersEmpty') }}</p><div v-else class="user-results"><button v-for="user in userResults" :key="user.username" type="button" class="user-result" :aria-label="t('header.openUserProfile', { username: user.username })" @click="openUserProfile(user.username)"><span class="user-result-avatar">{{ (user.displayName || user.username).slice(0, 1).toUpperCase() }}</span><span><strong>{{ user.displayName || `@${user.username}` }}</strong><small>@{{ user.username }}<template v-if="user.location"> · {{ user.location }}</template></small></span></button></div></div></div>
        <div class="menu-item"><button :aria-expanded="activeMenu === 'about'" @click.stop="toggleMenu('about')">{{ t('header.about') }}</button><div v-if="activeMenu === 'about'" class="menu-popover"><strong>{{ t('header.aboutTitle') }}</strong><p>{{ t('header.aboutDescription') }}</p><a href="/about">{{ t('header.readStory') }} <span>↗</span></a></div></div>
        <button class="studio-link" :class="{ active: route.path.startsWith('/admin') || route.path.startsWith('/account') }" :aria-label="t('account.personalCenter')" @click="router.push('/account')">{{ t('account.personalCenter') }}</button>
        <ThemeSwitcher />
        <LanguageSwitcher />
      </nav>
    </div>
  </header>
</template>

<style scoped>
.header { margin: var(--header-top) 0 var(--header-bottom); max-width: none; padding: 0 40px; position: relative; z-index: 10; }
.header-map { left: 0; margin: 0; max-width: none; padding: 0; position: absolute; right: 0; top: 0; }
.header-map .header-inner { margin-top: var(--header-top); padding-left: 40px; padding-right: 40px; }
.header-map .brand, .header-map .utility-nav a, .header-map .utility-nav > .menu-item > button, .header-map .studio-link { color: var(--map-header-ink); }
.header-map .brand-type small { color: var(--map-muted); }
.header-map .utility-nav a:hover, .header-map .utility-nav > .menu-item > button:hover, .header-map .studio-link:hover, .header-map .studio-link.active { background: var(--map-control-hover); color: var(--map-ink); }
.header-map :deep(.theme-trigger), .header-map :deep(.language-trigger) { color: var(--map-header-ink); }
.header-map :deep(.theme-trigger:hover), .header-map :deep(.theme-trigger[aria-expanded='true']), .header-map :deep(.language-trigger:hover), .header-map :deep(.language-trigger[aria-expanded='true']) { background: var(--map-control-hover); color: var(--map-ink); }
.header-map .brand { visibility: hidden; }
.header-inner { align-items: center; display: flex; height: var(--header-height); justify-content: space-between; width: 100%; }
.header-start { align-items: center; display: flex; flex: 0 1 55%; gap: 28px; min-width: 0; }
.header-start :deep(.category-bar.is-inline) { flex: 1 1 auto; min-width: 0; overflow: hidden; }
.header-start :deep(.category-bar.is-inline .category-nav) { overflow-x: auto; }
.viewer-chip { background: var(--surface-soft); border: 1px solid var(--line); border-radius: 999px; color: var(--ink); font-size: 11px; padding: 6px 9px; white-space: nowrap; }
.viewer-chip span { color: var(--muted); font-size: 14px; margin-left: 4px; }
.brand { align-items: center; background: transparent; color: var(--ink); display: inline-flex; justify-content: center; padding: 0; }
.utility-nav { align-items: center; display: flex; flex: 0 0 auto; gap: 4px; margin-left: auto; margin-right: 215px; }
.menu-item { position: relative; }
.utility-nav a, .utility-nav > .menu-item > button, .studio-link { background: transparent; border-radius: 4px; color: var(--muted); font-size: 13px; padding: 10px 12px; white-space: nowrap; }
.utility-nav a:hover, .utility-nav > .menu-item > button:hover, .studio-link:hover, .studio-link.active { background: var(--surface-soft); color: var(--ink); }
.menu-popover { background: color-mix(in srgb, var(--surface) 97%, var(--paper)); border: 1px solid var(--line); border-radius: 8px; box-shadow: var(--shadow); color: var(--ink); display: grid; gap: 9px; min-width: 230px; padding: 16px; position: absolute; right: 0; top: calc(100% + 8px); z-index: 20; }
.menu-popover strong { font-family: Georgia, ui-serif, serif; font-size: 15px; font-weight: 500; line-height: 1.25; }
.menu-popover p { color: var(--muted); font-size: 12px; line-height: 1.5; margin: 0; white-space: normal; }
.menu-popover a { color: var(--ink); font-size: 12px; padding: 0; }
.menu-popover a:hover { background: transparent; color: var(--accent-deep); }
.menu-popover span { color: var(--muted); margin-left: 5px; }
.compact-menu { gap: 4px; min-width: 140px; }
.user-search-popover { min-width: 280px; right: auto; left: 0; }
.user-search-field { align-items: center; border-bottom: 1px solid var(--line); color: var(--muted); display: flex; gap: 8px; padding-bottom: 9px; }
.user-search-field input { background: transparent; border: 0; color: var(--ink); font-size: 12px; min-width: 0; outline: 0; padding: 2px 0; width: 100%; }
.user-search-field input::placeholder { color: var(--muted); }
.search-status { color: var(--muted); font-size: 11px; margin: 4px 0 0; }
.user-results { display: grid; gap: 3px; margin: 2px -6px -6px; }
.user-result { align-items: center; background: transparent; border-radius: 4px; display: flex; gap: 9px; padding: 7px 6px; text-align: left; width: 100%; }
.user-result:hover { background: var(--surface-soft); }
.user-result-avatar { align-items: center; background: var(--surface-soft); border-radius: 50%; color: var(--accent-deep); display: flex; flex: 0 0 auto; font-size: 11px; font-weight: 700; height: 27px; justify-content: center; width: 27px; }
.user-result span:last-child { display: grid; gap: 2px; min-width: 0; }
.user-result strong { font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.user-result small { color: var(--muted); font-size: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
@media (max-width: 1180px) { .header { padding-left: 28px; padding-right: 28px; } .header-map { padding-left: 0; padding-right: 0; } .header-map .header-inner { padding-left: 28px; padding-right: 28px; } }
@media (max-width: 580px) {
  .header { margin: 24px auto 22px; padding: 0 16px; }
  .header-map { margin: 0; padding: 0; }
  .header-map .header-inner { margin-top: 24px; padding-left: 16px; padding-right: 16px; }
  .header-map .header-inner { display: none; }
  .header-inner { align-items: flex-start; flex-direction: column; gap: 18px; height: auto; }
  .header-start { align-items: flex-start; flex-direction: column; gap: 12px; width: 100%; }
  .header-start :deep(.category-bar.is-inline) { width: 100%; }
  .utility-nav { gap: 0; margin-left: -12px; margin-right: 0; max-width: calc(100vw - 32px); min-width: 0; overflow-x: auto; padding-bottom: 2px; scrollbar-width: none; }
  .utility-nav::-webkit-scrollbar { display: none; }
  .utility-nav a, .utility-nav > .menu-item > button, .studio-link { font-size: 12px; padding: 7px 12px; }
  .menu-popover { left: 0; max-width: calc(100vw - 32px); right: auto; top: calc(100% + 8px); }
  .user-search-popover { min-width: min(280px, calc(100vw - 32px)); }
}
</style>
