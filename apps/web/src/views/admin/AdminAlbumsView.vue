<script setup lang="ts">
import { Check, FolderPlus, LoaderCircle, Pencil, Trash2, X } from 'lucide-vue-next';
import { computed, onMounted, ref, watch } from 'vue';
import { createAdminAlbum, deleteAdminAlbum, isApiConfigured, listAdminAlbums, listAdminPhotos, patchAdminAlbum, type AdminPhoto } from '../../api/client';
import { useSessionStore } from '../../stores/session';
import { useWorkspaceStore } from '../../stores/workspace';
import type { AdminAlbum } from '@negative25/contracts';
import { useLocale } from '../../i18n';

type Draft = { id: string | null; title: string; description: string; shootDate: string; coverPhotoId: string; photoIds: string[] };
const emptyDraft = (): Draft => ({ id: null, title: '', description: '', shootDate: '', coverPhotoId: '', photoIds: [] });
const session = useSessionStore();
const workspace = useWorkspaceStore();
const albums = ref<AdminAlbum[]>([]);
const photos = ref<AdminPhoto[]>([]);
const draft = ref<Draft | null>(null);
const loading = ref(false);
const busy = ref(false);
const error = ref<string | null>(null);
const canEdit = computed(() => ['owner', 'admin', 'editor'].includes(workspace.active?.role ?? 'viewer'));
const { t } = useLocale();

async function load(): Promise<void> {
  if (!isApiConfigured() || !session.accessToken) return;
  loading.value = true;
  error.value = null;
  try { [albums.value, photos.value] = await Promise.all([listAdminAlbums(workspace.slug, session.accessToken), listAdminPhotos(workspace.slug, session.accessToken)]); } catch (cause) { error.value = cause instanceof Error ? cause.message : t('admin.loadAlbumsError'); } finally { loading.value = false; }
}
function startCreate(): void { draft.value = emptyDraft(); }
function startEdit(album: AdminAlbum): void { draft.value = { id: album.id, title: album.title, description: album.description ?? '', shootDate: album.shootDate ?? '', coverPhotoId: album.coverPhotoId ?? '', photoIds: [...album.photoIds] }; }
function albumCover(album: AdminAlbum): AdminPhoto | undefined {
  return photos.value.find((photo) => photo.id === album.coverPhotoId) ?? photos.value.find((photo) => album.photoIds.includes(photo.id));
}
function togglePhoto(id: string): void { if (!draft.value) return; const selected = new Set(draft.value.photoIds); selected.has(id) ? selected.delete(id) : selected.add(id); draft.value.photoIds = [...selected]; if (draft.value.coverPhotoId && !selected.has(draft.value.coverPhotoId)) draft.value.coverPhotoId = ''; }
async function save(): Promise<void> {
  if (!draft.value || !session.accessToken || busy.value || !draft.value.title.trim()) return;
  busy.value = true;
  error.value = null;
  const input = { title: draft.value.title.trim(), description: draft.value.description.trim(), shootDate: draft.value.shootDate || null, coverPhotoId: draft.value.coverPhotoId || null, photoIds: draft.value.photoIds };
  try { if (draft.value.id) await patchAdminAlbum(workspace.slug, draft.value.id, input, session.accessToken); else await createAdminAlbum(workspace.slug, input, session.accessToken); draft.value = null; await load(); } catch (cause) { error.value = cause instanceof Error ? cause.message : t('admin.saveAlbumError'); } finally { busy.value = false; }
}
async function remove(album: AdminAlbum): Promise<void> {
  if (!session.accessToken || busy.value || !window.confirm(t('admin.deleteAlbumConfirm', { title: album.title }))) return;
  busy.value = true;
  error.value = null;
  try { await deleteAdminAlbum(workspace.slug, album.id, session.accessToken); if (draft.value?.id === album.id) draft.value = null; await load(); } catch (cause) { error.value = cause instanceof Error ? cause.message : t('admin.deleteAlbumError'); } finally { busy.value = false; }
}
onMounted(load);
watch(() => workspace.slug, () => { draft.value = null; void load(); });
</script>

<template>
  <section class="admin-view">
    <div class="view-heading"><div><span class="eyebrow">{{ t('admin.albumsEyebrow') }}</span><h2>{{ t('admin.albumsTitle') }}</h2><p>{{ t('admin.albumsDescription') }}</p></div><button v-if="canEdit" class="primary-action" @click="startCreate"><FolderPlus :size="16" /> {{ t('admin.newAlbum') }}</button></div>
    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    <section v-if="draft && canEdit" class="album-editor">
      <div class="editor-heading"><div><span class="eyebrow">{{ draft.id ? t('admin.editAlbum') : t('admin.newAlbum') }}</span><h3>{{ draft.title || t('admin.untitledCollection') }}</h3></div><button class="icon-action" :aria-label="t('admin.closeEditor')" @click="draft = null"><X :size="17" /></button></div>
      <div class="editor-fields"><label>{{ t('admin.title') }}<input v-model="draft.title" maxlength="160" required /></label><label>{{ t('admin.shootDate') }}<input v-model="draft.shootDate" type="date" /></label><label class="wide">{{ t('admin.description') }}<textarea v-model="draft.description" maxlength="2000" rows="3"></textarea></label><label>{{ t('admin.cover') }}<select v-model="draft.coverPhotoId"><option value="">{{ t('admin.firstSelectedPhoto') }}</option><option v-for="photo in photos.filter((item) => draft?.photoIds.includes(item.id))" :key="photo.id" :value="photo.id">{{ photo.title || t('admin.untitledPhoto') }}</option></select></label></div>
      <div class="photo-picker-heading"><strong>{{ t('admin.photographs') }}</strong><span>{{ t('admin.selected', { count: draft.photoIds.length }) }}</span></div>
      <div v-if="!photos.length" class="photos-empty">{{ t('admin.importBeforeAlbum') }}</div>
      <div v-else class="photo-picker"><button v-for="photo in photos" :key="photo.id" type="button" class="photo-option" :class="{ selected: draft.photoIds.includes(photo.id) }" :aria-pressed="draft.photoIds.includes(photo.id)" @click="togglePhoto(photo.id)"><img v-if="photo.thumbnail?.url" :src="photo.thumbnail.url" :alt="photo.title" /><span v-else class="photo-placeholder"></span><span class="photo-option-copy"><strong>{{ photo.title || t('admin.untitledPhoto') }}</strong><small>{{ photo.published && !photo.hidden ? t('admin.published') : t('admin.notPublic') }}</small></span><span class="check"><Check :size="14" /></span></button></div>
      <div class="editor-actions"><button class="secondary-action" @click="draft = null">{{ t('admin.cancel') }}</button><button class="save-action" :disabled="busy || !draft.title.trim()" @click="save"><Check :size="16" /> {{ busy ? t('admin.saving') : t('admin.saveAlbum') }}</button></div>
    </section>
    <div v-if="loading" class="albums-empty"><LoaderCircle :size="16" class="spin" /> {{ t('album.loading') }}...</div>
    <div v-else-if="!albums.length" class="albums-empty">{{ t('admin.noAlbums') }}</div>
    <section v-else class="album-list" :aria-label="t('admin.albums')">
      <div v-for="album in albums" :key="album.id" class="album-row">
        <div class="album-cover">
          <img v-if="albumCover(album)?.thumbnail?.url" :src="albumCover(album)?.thumbnail?.url" :alt="album.title" />
          <span v-else>{{ t('admin.noCover') }}</span>
        </div>
        <div class="album-copy">
          <strong>{{ album.title }}</strong>
          <p v-if="album.description" class="album-description">{{ album.description }}</p>
          <div class="album-meta"><span v-if="album.shootDate">{{ t('admin.shootDate') }}：{{ album.shootDate }}</span><span>{{ t('admin.albumPhotoCount', { count: album.photoCount }) }}</span></div>
        </div>
        <template v-if="canEdit"><div class="album-actions"><button class="icon-action" :aria-label="t('admin.edit', { title: album.title })" @click="startEdit(album)"><Pencil :size="15" /></button><button class="icon-action danger" :aria-label="t('admin.delete', { title: album.title })" @click="remove(album)"><Trash2 :size="15" /></button></div></template>
      </div>
    </section>
  </section>
</template>

<style scoped>
.admin-view { max-width: 900px; }.view-heading { align-items: flex-end; display: flex; gap: 18px; justify-content: space-between; margin-bottom: 48px; }.view-heading h2 { font-size: 37px; letter-spacing: -.045em; margin: 10px 0 6px; }.view-heading p { color: var(--muted); margin: 0; }.primary-action, .save-action { align-items: center; background: var(--ink); border-radius: 4px; color: var(--paper); display: inline-flex; font-size: 13px; gap: 8px; padding: 11px 15px; }.primary-action:hover, .save-action:hover { background: var(--accent-deep); }.form-error { color: #a34d4d; font-size: 12px; margin: -28px 0 22px; }.album-editor { border-bottom: 1px solid var(--line); border-top: 1px solid var(--line); margin-bottom: 38px; padding: 22px 0 25px; }.editor-heading { align-items: flex-start; display: flex; justify-content: space-between; }.editor-heading h3 { font-size: 18px; margin: 8px 0 0; }.icon-action { align-items: center; background: transparent; border: 1px solid var(--line); border-radius: 50%; color: var(--muted); display: inline-flex; flex: 0 0 auto; height: 32px; justify-content: center; width: 32px; }.icon-action:hover { background: var(--surface-soft); color: var(--ink); }.icon-action.danger:hover { color: #a34d4d; }.editor-fields { display: grid; gap: 15px; grid-template-columns: repeat(2, minmax(0, 1fr)); margin-top: 24px; }.editor-fields label { color: var(--muted); display: grid; font-size: 12px; gap: 7px; }.editor-fields .wide { grid-column: 1 / -1; }.editor-fields input, .editor-fields textarea, .editor-fields select { background: var(--surface); border: 1px solid var(--line); border-radius: 4px; color: var(--ink); font: inherit; padding: 9px 10px; resize: vertical; }.editor-fields input:focus, .editor-fields textarea:focus, .editor-fields select:focus { border-color: var(--accent-deep); outline: 2px solid color-mix(in srgb, var(--accent) 35%, transparent); }.photo-picker-heading { align-items: center; display: flex; justify-content: space-between; margin: 28px 0 10px; }.photo-picker-heading strong { font-size: 13px; }.photo-picker-heading span { color: var(--muted); font-size: 11px; }.photo-picker { display: grid; gap: 8px; grid-template-columns: repeat(2, minmax(0, 1fr)); max-height: 360px; overflow-y: auto; }.photo-option { align-items: center; background: transparent; border: 1px solid var(--line); color: inherit; display: flex; gap: 10px; min-width: 0; padding: 7px; text-align: left; }.photo-option:hover, .photo-option.selected { background: var(--surface-soft); border-color: var(--accent); }.photo-option img, .photo-placeholder { background: var(--surface-soft); flex: 0 0 auto; height: 46px; object-fit: cover; width: 58px; }.photo-option-copy { display: grid; gap: 4px; min-width: 0; }.photo-option-copy strong { font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.photo-option-copy small { color: var(--muted); font-size: 10px; }.check { align-items: center; border: 1px solid var(--line); border-radius: 3px; color: transparent; display: flex; flex: 0 0 auto; height: 19px; justify-content: center; margin-left: auto; width: 19px; }.photo-option.selected .check { background: var(--ink); border-color: var(--ink); color: var(--paper); }.photos-empty, .albums-empty { align-items: center; color: var(--muted); display: flex; font-size: 13px; gap: 7px; padding: 24px 0; }.editor-actions { display: flex; gap: 9px; justify-content: flex-end; margin-top: 22px; }.secondary-action { background: transparent; border: 1px solid var(--line); border-radius: 4px; color: var(--muted); font-size: 12px; padding: 9px 13px; }.save-action { font-size: 12px; padding: 9px 13px; }.save-action:disabled { cursor: wait; opacity: .55; }.album-list { border-top: 1px solid var(--line); }.album-row { align-items: center; border-bottom: 1px solid var(--line); display: grid; gap: 16px; grid-template-columns: 132px minmax(0, 1fr) auto; min-height: 132px; padding: 14px 0; }.album-cover { aspect-ratio: 4 / 3; background: var(--surface-soft); border-radius: 3px; display: grid; overflow: hidden; place-items: center; width: 132px; }.album-cover img { height: 100%; object-fit: cover; width: 100%; }.album-cover span { color: var(--muted); font-size: 10px; padding: 8px; text-align: center; }.album-copy { align-content: center; display: grid; gap: 7px; min-width: 0; }.album-copy strong { font-size: 15px; }.album-description { color: var(--muted); font-size: 12px; line-height: 1.5; margin: 0; overflow-wrap: anywhere; white-space: pre-wrap; }.album-meta { align-items: center; display: flex; flex-wrap: wrap; gap: 6px 14px; }.album-meta span { color: var(--muted); font-size: 11px; }.album-actions { display: flex; gap: 8px; }.spin { animation: spin 1s linear infinite; }@keyframes spin { to { transform: rotate(360deg); } }
@media (max-width: 640px) { .view-heading { align-items: flex-start; flex-direction: column; }.view-heading h2 { font-size: 31px; }.editor-fields, .photo-picker { grid-template-columns: 1fr; }.album-row { gap: 11px; grid-template-columns: 88px minmax(0, 1fr); min-height: 88px; padding: 11px 0; }.album-cover { width: 88px; }.album-actions { grid-column: 2; justify-content: flex-start; } }
</style>
