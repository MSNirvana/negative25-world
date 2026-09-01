<script setup lang="ts">
import { ArrowUpRight, CheckCircle2, Clock3, Images, LoaderCircle, Upload } from 'lucide-vue-next';
import { onMounted, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import { fetchAdminSummary, isApiConfigured } from '../../api/client';
import { useSessionStore } from '../../stores/session';
import { useWorkspaceStore } from '../../stores/workspace';
import type { AdminSummary } from '@negative25/contracts';
import { useLocale } from '../../i18n';

const session = useSessionStore();
const workspace = useWorkspaceStore();
const summary = ref<AdminSummary | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const { t } = useLocale();

async function loadSummary(): Promise<void> {
  if (!isApiConfigured() || !session.accessToken) return;
  loading.value = true;
  error.value = null;
  try {
    summary.value = await fetchAdminSummary(workspace.slug, session.accessToken);
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : t('admin.loadSummaryError');
  } finally {
    loading.value = false;
  }
}

function activityLabel(status: string): string {
  return status === 'completed' ? t('admin.importCompleted') : status === 'failed' ? t('admin.importAttention') : t('admin.importProcessing');
}

function activityTime(value: string): string {
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(elapsed / 60000);
  if (minutes < 1) return t('admin.now');
  if (minutes < 60) return t('admin.minutesAgo', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('admin.hoursAgo', { count: hours });
  return t('admin.daysAgo', { count: Math.floor(hours / 24) });
}

onMounted(loadSummary);
watch(() => workspace.slug, loadSummary);
</script>

<template>
  <section class="admin-view"><div class="view-heading"><div><span class="eyebrow">{{ t('admin.overviewEyebrow') }}</span><h2>{{ summary?.workspace.name ?? t('admin.studio') }}</h2><p>{{ t('admin.keepArchiveMoving') }}</p></div><RouterLink class="primary-action" to="/admin/imports"><Upload :size="16" /> {{ t('admin.importPhotos') }}</RouterLink></div><p v-if="error" class="form-error" role="alert">{{ error }}</p><div class="stats"><div><span class="stat-icon"><Images :size="17" /></span><strong>{{ summary?.stats.publishedPhotoCount ?? 0 }}</strong><span class="muted">{{ t('admin.publishedPhotos') }}</span></div><div><span class="stat-icon"><CheckCircle2 :size="17" /></span><strong>{{ workspace.spaces.length || (summary ? 1 : 0) }}</strong><span class="muted">{{ t('admin.workspaces') }}</span></div><div><span class="stat-icon"><Clock3 :size="17" /></span><strong>{{ summary?.stats.pendingImportCount ?? 0 }}</strong><span class="muted">{{ t('admin.pendingImports') }}</span></div></div><section class="recent-section"><div class="section-heading"><h3>{{ t('admin.recentActivity') }}</h3><ArrowUpRight :size="17" /></div><div v-if="loading" class="activity-empty"><LoaderCircle :size="16" class="spin" /> {{ t('admin.loadingActivity') }}</div><div v-else-if="summary?.recentActivity.length" v-for="activity in summary.recentActivity" :key="activity.id" class="activity-row"><span class="activity-dot" :class="{ failed: activity.status === 'failed' }"></span><div><strong>{{ activityLabel(activity.status) }}</strong><p>{{ t('admin.processed', { completed: activity.completed, total: activity.total }) }}<span v-if="activity.failed">{{ t('admin.failed', { count: activity.failed }) }}</span>.</p></div><span class="muted">{{ activityTime(activity.createdAt) }}</span></div><div v-else class="activity-empty">{{ t('admin.noImports') }}</div></section></section>
</template>

<style scoped>
.view-heading { align-items: flex-end; display: flex; justify-content: space-between; gap: 18px; }.view-heading h2 { font-size: 37px; letter-spacing: -.045em; margin: 10px 0 6px; }.view-heading p { color: var(--muted); margin: 0; }.primary-action { align-items: center; background: var(--ink); border-radius: 4px; color: var(--paper); display: inline-flex; font-size: 13px; gap: 8px; padding: 11px 15px; }.primary-action:hover { background: var(--accent-deep); }.stats { border-bottom: 1px solid var(--line); border-top: 1px solid var(--line); display: grid; gap: 20px; grid-template-columns: repeat(3, 1fr); margin-top: 54px; padding: 22px 0; }.stats > div { display: grid; gap: 5px; position: relative; }.stats strong { font-size: 28px; font-weight: 550; }.stat-icon { color: var(--accent-deep); }.stats .muted { font-size: 12px; }.recent-section { margin-top: 48px; max-width: 700px; }.section-heading { align-items: center; border-bottom: 1px solid var(--line); display: flex; justify-content: space-between; padding-bottom: 13px; }.section-heading h3 { font-size: 14px; margin: 0; }.activity-row { align-items: flex-start; border-bottom: 1px solid var(--line); display: flex; gap: 13px; padding: 19px 0; }.activity-dot { background: var(--accent); border-radius: 50%; flex: 0 0 auto; height: 8px; margin-top: 5px; width: 8px; }.activity-dot.failed { background: #a34d4d; }.activity-row strong { font-size: 13px; }.activity-row p { color: var(--muted); font-size: 13px; margin: 6px 0 0; }.activity-row > .muted { font-size: 12px; margin-left: auto; }.activity-empty { align-items: center; color: var(--muted); display: flex; font-size: 13px; gap: 7px; padding: 22px 0; }.form-error { color: #a34d4d; font-size: 12px; margin: -28px 0 22px; }.spin { animation: spin 1s linear infinite; }
@media (max-width: 600px) { .view-heading { align-items: flex-start; flex-direction: column; }.view-heading h2 { font-size: 31px; }.stats { gap: 10px; }.stats strong { font-size: 23px; } }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
