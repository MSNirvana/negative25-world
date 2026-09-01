<script setup lang="ts">
import { Check, ImagePlus, X } from 'lucide-vue-next';
import { computed, onMounted, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import { isApiConfigured, listAdminPhotos, patchAdminPhoto, type AdminPhoto } from '../../api/client';
import AdminLocationPicker from '../../components/admin/AdminLocationPicker.vue';
import { formatPhotoDisplayLocation } from '../../lib/photo-display-location';
import { useSessionStore } from '../../stores/session';
import { useWorkspaceStore } from '../../stores/workspace';
import { useLocale } from '../../i18n';
type ViewPhoto = AdminPhoto;
type PhotoStatus = 'published' | 'ownerOnly' | 'hidden';
const session = useSessionStore();
const workspace = useWorkspaceStore();
const photos = ref<ViewPhoto[]>([]);
const locationFilter = ref('');
const statusFilter = ref<'all' | PhotoStatus>('all');
const loading = ref(false);
const error = ref<string | null>(null);
const editingId = ref<string | null>(null);
const statusSavingId = ref<string | null>(null);
const draft = ref({ title: '', description: '', rating: '', locationName: '', displayAddress: '', displayRegion: '', displayRegionEnabled: true, latitude: null as number | null, longitude: null as number | null });
const saving = ref(false);
const { t } = useLocale();
async function loadPhotos(): Promise<void> {
  if (!isApiConfigured() || !session.accessToken) return;
  loading.value = true;
  error.value = null;
  try {
    const result = await listAdminPhotos(workspace.slug, session.accessToken);
    photos.value = result;
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : t('admin.loadPhotosError');
  } finally {
    loading.value = false;
  }
}
onMounted(loadPhotos);
watch(() => workspace.slug, loadPhotos);
function isOwnerOnly(photo: ViewPhoto): boolean {
  return photo.ownerOnly === true || photo.metadata?.ownerOnly === true;
}
function photoStatus(photo: ViewPhoto): PhotoStatus {
  if (isOwnerOnly(photo)) return 'ownerOnly';
  if (photo.published && !photo.hidden) return 'published';
  return 'hidden';
}
const filteredPhotos = computed(() => {
  const locationNeedle = locationFilter.value.trim().toLocaleLowerCase();
  return photos.value.filter((photo) => {
    if (statusFilter.value !== 'all' && photoStatus(photo) !== statusFilter.value) return false;
    if (!locationNeedle) return true;
    const metadata = photo.metadata ?? {};
    const candidates = [locationLabel(photo), photo.location?.name, textFrom(metadata.locationName), textFrom(metadata.displayAddress)].filter((value): value is string => Boolean(value));
    return candidates.some((value) => value.toLocaleLowerCase().includes(locationNeedle));
  });
});
async function changeStatus(photo: ViewPhoto, event: Event): Promise<void> {
  const nextStatus = (event.target as HTMLSelectElement).value as PhotoStatus;
  const previous = { published: photo.published, hidden: photo.hidden, ownerOnly: photo.ownerOnly };
  if (nextStatus === photoStatus(photo) || statusSavingId.value) return;
  const next = { published: nextStatus === 'published' || nextStatus === 'ownerOnly', hidden: nextStatus === 'hidden', ownerOnly: nextStatus === 'ownerOnly' };
  Object.assign(photo, next);
  if (!isApiConfigured() || !session.accessToken) return;
  statusSavingId.value = photo.id;
  error.value = null;
  try {
    const updated = await patchAdminPhoto(workspace.slug, photo.id, next, session.accessToken);
    replacePhoto(photo, updated);
  } catch (cause) {
    Object.assign(photo, previous);
    error.value = cause instanceof Error ? cause.message : t('admin.updatePhotoError');
  } finally {
    statusSavingId.value = null;
  }
}
function beginEdit(photo: ViewPhoto): void {
  editingId.value = photo.id;
  const metadata = photo.metadata ?? {};
  const locationName = photo.location?.name ?? '';
  draft.value = {
    title: photo.title,
    description: photo.description,
    rating: photo.rating == null ? '' : String(photo.rating),
    locationName,
    displayAddress: textFrom(metadata.displayAddress) || locationName,
    displayRegion: textFrom(metadata.displayRegion),
    displayRegionEnabled: typeof metadata.displayRegionEnabled === 'boolean' ? metadata.displayRegionEnabled : true,
    latitude: photo.latitude ?? coordinateFrom(photo.metadata?.latitude),
    longitude: photo.longitude ?? coordinateFrom(photo.metadata?.longitude),
  };
  error.value = null;
}
function cancelEdit(): void {
  editingId.value = null;
}
async function saveEdit(photo: ViewPhoto): Promise<void> {
  if (!session.accessToken || saving.value) return;
  const rating = draft.value.rating.trim() === '' ? null : Number(draft.value.rating);
  if (rating !== null && (!Number.isInteger(rating) || rating < 0 || rating > 7)) {
    error.value = t('admin.ratingError');
    return;
  }
  saving.value = true;
  error.value = null;
  try {
    const latitude = draft.value.latitude;
    const longitude = draft.value.longitude;
    const hasLocation = latitude !== null && longitude !== null && Number.isFinite(latitude) && Number.isFinite(longitude);
    if ((latitude === null) !== (longitude === null) || (latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) || (longitude !== null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180))) {
      error.value = t('admin.locationCoordinatesError');
      return;
    }
    const updated = await patchAdminPhoto(workspace.slug, photo.id, {
      title: draft.value.title.trim(),
      description: draft.value.description.trim(),
      rating,
      location: hasLocation ? { name: draft.value.locationName.trim(), latitude, longitude, displayAddress: draft.value.displayAddress.trim(), displayRegion: draft.value.displayRegion.trim(), displayRegionEnabled: draft.value.displayRegionEnabled } : null,
    }, session.accessToken);
    replacePhoto(photo, updated);
    editingId.value = null;
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : t('admin.savePhotoError');
  } finally {
    saving.value = false;
  }
}
function coordinateFrom(value: unknown): number | null {
  const number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(number) ? number : null;
}
function textFrom(value: unknown): string { return typeof value === 'string' ? value.trim() : ''; }
function locationLabel(photo: ViewPhoto): string {
  const metadata = photo.metadata ?? {};
  const latitude = photo.latitude ?? coordinateFrom(photo.metadata?.latitude);
  const longitude = photo.longitude ?? coordinateFrom(photo.metadata?.longitude);
  const standardName = photo.location?.name || (latitude !== null && longitude !== null ? `${latitude.toFixed(5)}, ${longitude.toFixed(5)}` : '');
  return formatPhotoDisplayLocation({ standardName, displayAddress: metadata.displayAddress, displayRegion: metadata.displayRegion, displayRegionEnabled: metadata.displayRegionEnabled }, t('admin.unspecifiedLocation'));
}
function applyLocation(selection: { name: string; displayAddress: string; region: string; latitude: number; longitude: number }): void {
  draft.value.locationName = selection.name;
  draft.value.displayAddress = selection.displayAddress;
  draft.value.displayRegion = selection.region;
  draft.value.displayRegionEnabled = true;
  draft.value.latitude = selection.latitude;
  draft.value.longitude = selection.longitude;
}
function clearLocation(): void {
  draft.value.locationName = '';
  draft.value.displayAddress = '';
  draft.value.displayRegion = '';
  draft.value.displayRegionEnabled = false;
  draft.value.latitude = null;
  draft.value.longitude = null;
}
function replacePhoto(previous: ViewPhoto, next: AdminPhoto): void {
  const index = photos.value.findIndex((photo) => photo.id === previous.id);
  if (index >= 0) photos.value[index] = next;
}
</script>

<template>
  <section class="admin-view">
    <div class="view-heading"><div><span class="eyebrow">{{ t('admin.photosEyebrow') }}</span><h2>{{ t('admin.photosTitle') }}</h2><p>{{ t('admin.photosDescription', { workspace: workspace.active?.name ?? t('admin.workspace') }) }}</p></div><RouterLink class="primary-action" to="/admin/imports"><ImagePlus :size="16" /> {{ t('admin.addPhotos') }}</RouterLink></div>
    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    <div v-if="loading" class="loading-line">{{ t('admin.loadingPhotos') }}</div>
    <div v-else-if="!photos.length" class="loading-line">{{ t('admin.noPhotos') }}</div>
    <div v-else>
      <div class="photo-filters" :aria-label="t('admin.tableStatus')">
        <label class="filter-field"><span>{{ t('admin.filterLocation') }}</span><input v-model="locationFilter" type="search" :placeholder="t('admin.filterLocationPlaceholder')" /></label>
        <label class="filter-field"><span>{{ t('admin.filterStatus') }}</span><select v-model="statusFilter"><option value="all">{{ t('admin.filterAllStatuses') }}</option><option value="published">{{ t('admin.published') }}</option><option value="ownerOnly">{{ t('admin.ownerOnly') }}</option><option value="hidden">{{ t('admin.hidden') }}</option></select></label>
      </div>
      <div v-if="!filteredPhotos.length" class="loading-line filtered-empty">{{ t('admin.noFilteredPhotos') }}</div>
      <div v-else class="photo-table" role="table">
        <div class="table-head" role="row"><span>{{ t('admin.tablePhoto') }}</span><span>{{ t('admin.tablePlace') }}</span><span>{{ t('admin.tableStatus') }}</span><span></span></div>
        <template v-for="photo in filteredPhotos" :key="photo.id">
          <div class="photo-row" role="row"><div class="photo-name"><img v-if="photo.thumbnail?.url" class="mini-thumb" :src="photo.thumbnail.url" :alt="photo.title" /><span v-else class="mini-thumb"></span><strong>{{ photo.title || t('admin.untitledPhoto') }}</strong></div><span class="muted">{{ locationLabel(photo) }}</span><select class="status-select" :value="photoStatus(photo)" :disabled="statusSavingId === photo.id" :aria-label="t('admin.tableStatus')" @change="changeStatus(photo, $event)"><option value="published">{{ t('admin.published') }}</option><option value="ownerOnly">{{ t('admin.ownerOnly') }}</option><option value="hidden">{{ t('admin.hidden') }}</option></select><button class="more" :aria-label="t('admin.editPhoto')" @click="beginEdit(photo)">...</button></div>
          <form v-if="editingId === photo.id" class="editor" @submit.prevent="saveEdit(photo)">
            <div class="editor-fields"><label>{{ t('admin.title') }}<input v-model="draft.title" maxlength="240" required /></label><label>{{ t('admin.description') }}<textarea v-model="draft.description" maxlength="5000" rows="3"></textarea></label><label>{{ t('admin.rating') }}<input v-model="draft.rating" inputmode="numeric" min="0" max="7" :placeholder="t('admin.ratingPlaceholder')" /></label></div>
            <AdminLocationPicker :name="draft.locationName" :latitude="draft.latitude" :longitude="draft.longitude" :disabled="saving" @select="applyLocation" @clear="clearLocation" />
            <div class="display-location-fields">
              <label>{{ t('admin.displayAddress') }}<input v-model="draft.displayAddress" maxlength="240" :placeholder="t('admin.displayAddressPlaceholder')" :disabled="saving" /></label>
              <label class="prefix-toggle"><input v-model="draft.displayRegionEnabled" type="checkbox" :disabled="saving || draft.latitude === null || draft.longitude === null" /><span>{{ t('admin.displayRegionPrefix') }}<small v-if="draft.displayRegion">{{ draft.displayRegion }}</small></span></label>
            </div>
            <div class="editor-actions"><button type="submit" class="save" :disabled="saving"><Check :size="15" /> {{ saving ? t('admin.saving') : t('admin.saveDetails') }}</button><button type="button" class="cancel" @click="cancelEdit"><X :size="15" /> {{ t('admin.cancel') }}</button></div>
          </form>
        </template>
      </div>
    </div>
  </section>
</template>

<style scoped>
.admin-view { max-width: 900px; }.view-heading { align-items: flex-end; display: flex; justify-content: space-between; margin-bottom: 47px; }.view-heading h2 { font-size: 37px; letter-spacing: -.045em; margin: 10px 0 6px; }.view-heading p { color: var(--muted); margin: 0; }.primary-action { align-items: center; background: var(--ink); border-radius: 4px; color: var(--paper); display: inline-flex; font-size: 13px; gap: 8px; padding: 11px 15px; }.photo-table { border-top: 1px solid var(--line); }.table-head, .photo-row { align-items: center; display: grid; gap: 18px; grid-template-columns: minmax(190px, 1.5fr) 1fr 120px 30px; }.table-head { color: var(--muted); font-size: 11px; letter-spacing: .08em; padding: 13px 0; text-transform: uppercase; }.photo-row { border-top: 1px solid var(--line); font-size: 13px; padding: 15px 0; }.photo-name { align-items: center; display: flex; gap: 11px; min-width: 0; }.mini-thumb { background: var(--surface-soft); border-radius: 3px; height: 35px; width: 48px; }.status { align-items: center; background: transparent; color: var(--muted); display: inline-flex; font-size: 11px; gap: 5px; padding: 4px 0; }.status.published { color: #4f7e62; }.more { background: transparent; color: var(--muted); font-size: 15px; letter-spacing: 2px; padding: 4px; }.more:hover { color: var(--ink); }
.form-error { color: #a34d4d; font-size: 12px; margin: -25px 0 24px; }.loading-line { color: var(--muted); padding: 60px 0; text-align: center; }
@media (max-width: 700px) { .view-heading { align-items: flex-start; flex-direction: column; gap: 21px; }.table-head { display: none; }.photo-row { gap: 10px; grid-template-columns: minmax(150px, 1fr) auto 26px; }.photo-row > .muted { display: none; }.status { font-size: 0; }.status svg { height: 17px; width: 17px; } }
.mini-thumb { object-fit: cover; }
.editor { background: var(--surface-soft); border-top: 1px solid var(--line); display: grid; gap: 18px; padding: 18px 20px 20px; }
.editor-fields { display: grid; gap: 14px; grid-template-columns: minmax(180px, 1fr) minmax(240px, 1.6fr) 100px; }
.editor label { color: var(--muted); display: grid; font-size: 11px; gap: 6px; }
.editor input, .editor textarea { background: var(--surface); border: 1px solid var(--line); border-radius: 4px; color: var(--ink); font: inherit; font-size: 13px; padding: 9px 10px; resize: vertical; width: 100%; }
.editor input:focus, .editor textarea:focus { border-color: var(--accent-deep); outline: 2px solid color-mix(in srgb, var(--accent) 35%, transparent); }
.display-location-fields { align-items: end; display: grid; gap: 14px; grid-template-columns: minmax(220px, 1fr) minmax(180px, .8fr); }
.prefix-toggle { align-items: center; display: flex !important; gap: 8px !important; min-height: 37px; }
.prefix-toggle input { accent-color: var(--accent-deep); height: 15px; width: 15px; }
.prefix-toggle span { display: grid; gap: 2px; }
.prefix-toggle small { color: var(--muted); font-size: 10px; }
.editor-actions { display: flex; gap: 9px; }
.editor-actions button { align-items: center; border-radius: 4px; display: inline-flex; font-size: 12px; gap: 6px; padding: 9px 12px; }
.editor-actions .save { background: var(--ink); color: var(--paper); }
.editor-actions .cancel { background: transparent; color: var(--muted); }
.editor-actions button:disabled { cursor: wait; opacity: .55; }
@media (max-width: 700px) { .editor { padding: 16px 12px; }.editor-fields, .display-location-fields { grid-template-columns: 1fr; }.editor-actions { flex-wrap: wrap; } }
.status-select { background: var(--surface); border: 1px solid var(--line); border-radius: 4px; color: var(--muted); font-size: 11px; min-width: 110px; padding: 6px 7px; }.status-select:focus { border-color: var(--accent-deep); outline: 2px solid color-mix(in srgb, var(--accent) 35%, transparent); }.status-select:disabled { cursor: wait; opacity: .6; }
.photo-filters { align-items: end; display: flex; gap: 14px; margin-bottom: 24px; }.filter-field { color: var(--muted); display: grid; font-size: 11px; gap: 6px; }.filter-field input, .filter-field select { background: var(--surface); border: 1px solid var(--line); border-radius: 4px; color: var(--ink); font: inherit; font-size: 13px; min-width: 220px; padding: 9px 10px; }.filter-field select { min-width: 150px; }.filter-field input:focus, .filter-field select:focus { border-color: var(--accent-deep); outline: 2px solid color-mix(in srgb, var(--accent) 35%, transparent); }.filtered-empty { border-top: 1px solid var(--line); padding: 48px 0; }
@media (max-width: 700px) { .photo-filters { align-items: stretch; flex-direction: column; }.filter-field input, .filter-field select { min-width: 0; width: 100%; }.status-select { font-size: 10px; min-width: 92px; max-width: 100px; padding: 5px 4px; } }
</style>
