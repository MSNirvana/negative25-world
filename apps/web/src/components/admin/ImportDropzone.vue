<script setup lang="ts">
import { FolderOpen, Images, UploadCloud } from 'lucide-vue-next';
import { ref } from 'vue';
import { useLocale } from '../../i18n';
const emit = defineEmits<{ (event: 'files', files: File[]): void }>();
const { t } = useLocale();
const input = ref<HTMLInputElement>();
const folderInput = ref<HTMLInputElement>();
function selectedFiles(event: Event): File[] { const target = event.target as HTMLInputElement; const files = [...(target.files ?? [])]; target.value = ''; return files; }
function selectFiles(event: Event): void { const files = selectedFiles(event); if (files.length) emit('files', files); }
function selectFolder(event: Event): void { const files = selectedFiles(event); if (files.length) emit('files', files); }
function drop(event: DragEvent): void { event.preventDefault(); const files = [...(event.dataTransfer?.files ?? [])]; if (files.length) emit('files', files); }
</script>

<template><div class="dropzone" @dragover.prevent @drop="drop"><input ref="input" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif,.zip,application/zip" multiple hidden @change="selectFiles" /><input ref="folderInput" type="file" webkitdirectory directory multiple hidden @change="selectFolder" /><span class="drop-icon"><UploadCloud :size="22" /></span><strong>{{ t('dropzone.title') }}</strong><p>{{ t('dropzone.formats') }}</p><div class="picker-actions"><button class="secondary" type="button" @click="input?.click()"><Images :size="15" /> {{ t('dropzone.choose') }}</button><button class="secondary" type="button" @click="folderInput?.click()"><FolderOpen :size="15" /> {{ t('dropzone.chooseFolder') }}</button></div></div></template>
<style scoped>.dropzone { align-items: center; background: var(--surface); border: 1px dashed var(--line); border-radius: var(--radius); display: flex; flex-direction: column; gap: 9px; padding: 54px 25px; text-align: center; }.dropzone:hover { border-color: var(--accent); }.drop-icon { align-items: center; background: var(--surface-soft); border-radius: 50%; color: var(--accent-deep); display: flex; height: 45px; justify-content: center; width: 45px; }.dropzone strong { font-size: 14px; }.dropzone p { color: var(--muted); font-size: 12px; margin: 0; }.picker-actions { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-top: 8px; }.secondary { align-items: center; background: transparent; border: 1px solid var(--line); border-radius: 4px; display: inline-flex; font-size: 12px; gap: 7px; padding: 9px 13px; }.secondary:hover { background: var(--surface-soft); }</style>
