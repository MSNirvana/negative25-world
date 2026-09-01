<script setup lang="ts">
import { ArrowLeft, FolderOpen, FolderUp, Images, LayoutDashboard, Settings, UserRound } from 'lucide-vue-next';
import { onMounted } from 'vue';
import { RouterLink, RouterView, useRouter } from 'vue-router';
import { useSessionStore } from '../../stores/session';
import { useWorkspaceStore } from '../../stores/workspace';
import LanguageSwitcher from '../../components/LanguageSwitcher.vue';
import ThemeSwitcher from '../../components/ThemeSwitcher.vue';
import { useLocale } from '../../i18n';
const router = useRouter();
const session = useSessionStore();
const workspace = useWorkspaceStore();
const { t } = useLocale();
onMounted(async () => { await session.loadUser(); await workspace.load(session.accessToken); });
function selectWorkspace(event: Event): void {
  workspace.select((event.target as HTMLSelectElement).value);
}
</script>

<template>
  <div class="admin-shell page-frame">
    <aside class="admin-sidebar">
      <div class="admin-topline"><button class="back" @click="router.push('/')"><ArrowLeft :size="15" /> {{ t('admin.backGallery') }}</button><span class="admin-tools"><ThemeSwitcher /><LanguageSwitcher /></span></div>
      <div class="admin-title"><span class="eyebrow">{{ t('account.personalCenter') }}</span><h1>{{ t('account.personalCenter') }}</h1><label v-if="workspace.spaces.length" class="workspace-picker"><span class="sr-only">{{ t('admin.workspace') }}</span><select :value="workspace.slug" @change="selectWorkspace"><option v-for="space in workspace.spaces" :key="space.id" :value="space.slug">{{ space.name }}</option></select></label></div>
      <nav :aria-label="t('admin.navigation')">
        <RouterLink to="/account" exact-active-class="active"><LayoutDashboard :size="16" /> {{ t('admin.overview') }}</RouterLink>
        <RouterLink to="/account/imports" active-class="active"><FolderUp :size="16" /> {{ t('admin.imports') }}</RouterLink>
        <RouterLink to="/account/photos" active-class="active"><Images :size="16" /> {{ t('admin.photos') }}</RouterLink>
        <RouterLink to="/account/albums" active-class="active"><FolderOpen :size="16" /> {{ t('admin.albums') }}</RouterLink>
        <RouterLink to="/account/profile" active-class="active"><UserRound :size="16" /> {{ t('account.profile') }}</RouterLink>
        <RouterLink to="/account/settings" active-class="active"><Settings :size="16" /> {{ t('admin.settings') }}</RouterLink>
      </nav>
    </aside>
    <main class="admin-content"><p v-if="workspace.error" class="workspace-error" role="alert">{{ workspace.error }}</p><RouterView /></main>
  </div>
</template>

<style scoped>
.admin-topline { align-items: center; display: flex; justify-content: space-between; }.admin-tools { align-items: center; display: inline-flex; gap: 3px; }
.admin-shell { display: grid; gap: 70px; grid-template-columns: 220px minmax(0, 1fr); padding-bottom: 90px; padding-top: 54px; }.admin-sidebar { border-right: 1px solid var(--line); min-height: calc(100vh - 150px); padding-right: 30px; }.back { align-items: center; background: transparent; color: var(--muted); display: inline-flex; font-size: 12px; gap: 6px; padding: 0; }.back:hover { color: var(--ink); }.admin-title { padding: 54px 0 38px; }.admin-title h1 { font-size: 31px; letter-spacing: -.04em; margin: 8px 0 0; }.workspace-picker { display: block; margin-top: 19px; }.workspace-picker select { background: var(--surface); border: 1px solid var(--line); border-radius: 4px; color: var(--ink); font-size: 12px; max-width: 188px; padding: 8px 26px 8px 9px; width: 100%; }nav { display: grid; gap: 5px; }nav a { align-items: center; border-radius: 4px; color: var(--muted); display: flex; font-size: 13px; gap: 10px; padding: 10px 9px; }nav a:hover, nav a.active { background: var(--surface-soft); color: var(--ink); font-weight: 650; }.admin-content { min-width: 0; padding-top: 10px; }.workspace-error { color: #a34d4d; font-size: 12px; margin: 0 0 18px; }
@media (max-width: 760px) { .admin-shell { display: block; padding-top: 28px; }.admin-sidebar { border-bottom: 1px solid var(--line); border-right: 0; min-height: 0; padding: 0 0 19px; }.admin-title { padding: 27px 0 18px; }nav { display: flex; gap: 3px; overflow-x: auto; }nav a { flex: 0 0 auto; } .admin-content { padding-top: 32px; } }
</style>
