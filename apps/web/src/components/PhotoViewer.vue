<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { ArrowLeft, ArrowRight, Clipboard, Download, Maximize2, Minimize2, MoreHorizontal, Share2, X } from 'lucide-vue-next';
import type { GalleryPhoto } from '../stores/gallery';
import PhotoMeta from './PhotoMeta.vue';
import PhotoDetailPanel from './PhotoDetailPanel.vue';
import { useLocale } from '../i18n';

const props = defineProps<{ photo: GalleryPhoto; previous?: GalleryPhoto | null; next?: GalleryPhoto | null }>();
const emit = defineEmits<{ (event: 'close'): void; (event: 'previous'): void; (event: 'next'): void }>();
const copied = ref(false);
const shared = ref(false);
const toolsOpen = ref(false);
const detailsOpen = ref(false);
const { t } = useLocale();
const touchStartX = ref<number | null>(null);
const viewer = ref<HTMLElement | null>(null);
const viewerStage = ref<HTMLElement | null>(null);
const viewerImage = ref<HTMLImageElement | null>(null);
const zoom = ref(1);
const pan = ref({ x: 0, y: 0 });
const isDragging = ref(false);
const isFullscreen = ref(false);
const dragState = ref<{ pointerId: number; startX: number; startY: number; originX: number; originY: number } | null>(null);
const touchStartPoint = ref<{ x: number; y: number } | null>(null);
let lastTap: { time: number; x: number; y: number } | null = null;
const canPrevious = computed(() => Boolean(props.previous));
const canNext = computed(() => Boolean(props.next));
const fullscreenSupported = computed(() => typeof document !== 'undefined' && Boolean(document.fullscreenEnabled) && typeof HTMLElement !== 'undefined' && 'requestFullscreen' in HTMLElement.prototype);
const ZOOM_MIN = 1;
const ZOOM_MAX = 4;
const ZOOM_STEP = 0.25;

function onKey(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    if (detailsOpen.value) { detailsOpen.value = false; return; }
    if (zoom.value > ZOOM_MIN || pan.value.x !== 0 || pan.value.y !== 0) resetZoom();
    else emit('close');
    return;
  }
  if (detailsOpen.value) return;
  if (event.key === 'ArrowLeft' && canPrevious.value) emit('previous');
  if (event.key === 'ArrowRight' && canNext.value) emit('next');
  if (event.key === '+' || event.key === '=') setZoom(zoom.value + ZOOM_STEP);
  if (event.key === '-') setZoom(zoom.value - ZOOM_STEP);
  if (event.key === '0') resetZoom();
}
async function copyLink(): Promise<void> { await navigator.clipboard?.writeText(window.location.href); toolsOpen.value = false; copied.value = true; window.setTimeout(() => { copied.value = false; }, 1400); }
async function shareLink(): Promise<void> {
  toolsOpen.value = false;
  if (navigator.share) {
    await navigator.share({ title: props.photo.title, text: props.photo.caption || t('photo.archiveCaption'), url: window.location.href }).catch(() => undefined);
    return;
  }
  await copyLink();
  shared.value = true;
  window.setTimeout(() => { shared.value = false; }, 1400);
}

function clampZoom(value: number): number { return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Number(value.toFixed(2)))); }
function clampPan(x: number, y: number): { x: number; y: number } {
  const stage = viewerStage.value;
  const image = viewerImage.value;
  if (!stage || !image) return { x, y };
  const maxX = Math.max(0, (image.offsetWidth * zoom.value - stage.clientWidth) / 2 + 24);
  const maxY = Math.max(0, (image.offsetHeight * zoom.value - stage.clientHeight) / 2 + 24);
  return { x: Math.min(maxX, Math.max(-maxX, x)), y: Math.min(maxY, Math.max(-maxY, y)) };
}
function setZoom(value: number): void {
  zoom.value = clampZoom(value);
  if (zoom.value > ZOOM_MIN) { toolsOpen.value = false; detailsOpen.value = false; }
  if (zoom.value === ZOOM_MIN) pan.value = { x: 0, y: 0 };
  else pan.value = clampPan(pan.value.x, pan.value.y);
}
function toggleDetails(): void {
  toolsOpen.value = false;
  detailsOpen.value = !detailsOpen.value;
}
function resetZoom(): void { zoom.value = ZOOM_MIN; pan.value = { x: 0, y: 0 }; }
function toggleZoom(): void { zoom.value > ZOOM_MIN ? resetZoom() : setZoom(2); }
function onImageLoad(): void { pan.value = clampPan(pan.value.x, pan.value.y); }
function onWheel(event: WheelEvent): void {
  setZoom(zoom.value + (event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP));
}
function onPointerDown(event: PointerEvent): void {
  if (zoom.value <= ZOOM_MIN || event.button !== 0) return;
  const stage = event.currentTarget as HTMLElement;
  stage.setPointerCapture?.(event.pointerId);
  dragState.value = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, originX: pan.value.x, originY: pan.value.y };
  isDragging.value = true;
}
function onPointerMove(event: PointerEvent): void {
  const state = dragState.value;
  if (!state || state.pointerId !== event.pointerId) return;
  pan.value = clampPan(state.originX + event.clientX - state.startX, state.originY + event.clientY - state.startY);
}
function onPointerUp(event: PointerEvent): void {
  const state = dragState.value;
  if (!state || state.pointerId !== event.pointerId) return;
  const stage = event.currentTarget as HTMLElement;
  stage.releasePointerCapture?.(event.pointerId);
  dragState.value = null;
  isDragging.value = false;
}
async function toggleFullscreen(): Promise<void> {
  if (!viewer.value || !fullscreenSupported.value) return;
  try {
    if (document.fullscreenElement === viewer.value) await document.exitFullscreen();
    else await viewer.value.requestFullscreen();
  } catch { /* Browsers can reject fullscreen without a user gesture. */ }
}
function onFullscreenChange(): void {
  const wasFullscreen = isFullscreen.value;
  isFullscreen.value = document.fullscreenElement === viewer.value;
  if (wasFullscreen && !isFullscreen.value && zoom.value > ZOOM_MIN) resetZoom();
}
function onResize(): void { pan.value = clampPan(pan.value.x, pan.value.y); }
function onTouchStart(event: TouchEvent): void {
  const touch = event.changedTouches[0];
  if (!touch) return;
  touchStartPoint.value = { x: touch.clientX, y: touch.clientY };
  touchStartX.value = zoom.value > ZOOM_MIN ? null : touch.clientX;
}
function onTouchEnd(event: TouchEvent): void {
  const touch = event.changedTouches[0];
  const startPoint = touchStartPoint.value;
  touchStartPoint.value = null;
  touchStartX.value = null;
  if (!touch || !startPoint) return;
  const deltaX = touch.clientX - startPoint.x;
  const deltaY = touch.clientY - startPoint.y;
  const moved = Math.hypot(deltaX, deltaY) > 14;
  const now = Date.now();
  if (!moved && lastTap && now - lastTap.time < 320 && Math.hypot(touch.clientX - lastTap.x, touch.clientY - lastTap.y) < 32) {
    toggleZoom();
    lastTap = null;
    return;
  }
  if (!moved) lastTap = { time: now, x: touch.clientX, y: touch.clientY };
  else lastTap = null;
  if (zoom.value > ZOOM_MIN) return;
  const delta = deltaX;
  if (Math.abs(delta) > 50) delta > 0 ? emit('previous') : emit('next');
  if (Math.abs(delta) > 50) lastTap = null;
}
watch(() => props.photo.id, () => { resetZoom(); detailsOpen.value = false; });
onMounted(() => {
  window.addEventListener('keydown', onKey);
  window.addEventListener('resize', onResize);
  document.addEventListener('fullscreenchange', onFullscreenChange);
});
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey);
  window.removeEventListener('resize', onResize);
  document.removeEventListener('fullscreenchange', onFullscreenChange);
  if (document.fullscreenElement === viewer.value) void document.exitFullscreen().catch(() => undefined);
});
</script>

<template>
  <div ref="viewer" class="viewer" :class="{ 'is-zoomed': zoom > ZOOM_MIN, 'has-details-open': detailsOpen }" role="dialog" aria-modal="true" :aria-label="photo.title" @touchstart="onTouchStart" @touchend="onTouchEnd">
    <div class="viewer-top">
      <div class="viewer-top-actions">
        <button v-if="fullscreenSupported" class="fullscreen-action" type="button" :aria-label="t(isFullscreen ? 'photo.exitFullscreen' : 'photo.fullscreen')" :title="t(isFullscreen ? 'photo.exitFullscreen' : 'photo.fullscreen')" @click="toggleFullscreen"><Minimize2 v-if="isFullscreen" :size="19" /><Maximize2 v-else :size="19" /></button>
        <div class="tools-menu">
          <button class="more-action" type="button" :aria-label="t('photo.more')" :aria-expanded="toolsOpen" @click.stop="toolsOpen = !toolsOpen"><MoreHorizontal :size="20" /></button>
          <div v-if="toolsOpen" class="tools-popover" @click.stop>
            <button class="circle-action" :aria-label="t('photo.share')" :title="t('photo.share')" @click="shareLink"><Share2 :size="16" /></button>
            <button class="circle-action" :aria-label="t('photo.copyLink')" :title="t('photo.copyLink')" @click="copyLink"><Clipboard :size="16" /></button>
            <a class="circle-action" :href="photo.fullImage" target="_blank" rel="noreferrer" download :aria-label="t('photo.download', { title: photo.title })" :title="t('photo.download', { title: photo.title })"><Download :size="16" /></a>
          </div>
        </div>
        <span v-if="shared || copied" class="viewer-feedback" aria-live="polite">{{ shared ? t('photo.linkCopied') : t('photo.copied') }}</span>
        <button v-if="!detailsOpen" class="viewer-close" :aria-label="t('photo.close')" @click="$emit('close')"><X :size="20" /></button>
      </div>
    </div>
    <button class="viewer-nav viewer-nav-left" :disabled="!canPrevious" :aria-label="t('photo.previous')" @click="$emit('previous')"><ArrowLeft :size="22" /></button>
    <main class="viewer-main">
      <div ref="viewerStage" class="viewer-stage" :class="{ 'is-zoomed': zoom > ZOOM_MIN, 'is-dragging': isDragging, 'has-caption': Boolean(photo.caption?.trim()) }" @wheel.prevent="onWheel" @dblclick="toggleZoom" @pointerdown="onPointerDown" @pointermove="onPointerMove" @pointerup="onPointerUp" @pointercancel="onPointerUp">
      <div class="viewer-art">
        <p v-if="photo.caption?.trim()" class="viewer-caption">{{ photo.caption }}</p>
        <div class="viewer-image" :style="{ transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})` }"><img ref="viewerImage" :src="photo.fullImage" :alt="photo.title" draggable="false" @load="onImageLoad" /></div>
      </div>
      </div>
      <div class="viewer-info"><p v-if="!photo.caption?.trim()" class="sr-only">{{ t('photo.archiveCaption') }}</p><div class="viewer-meta"><PhotoMeta :photo="photo" :details-open="detailsOpen" @more="toggleDetails" /><PhotoDetailPanel v-if="detailsOpen" :photo="photo" @close="detailsOpen = false" /></div></div>
    </main>
    <button class="viewer-nav viewer-nav-right" :disabled="!canNext" :aria-label="t('photo.next')" @click="$emit('next')"><ArrowRight :size="22" /></button>
  </div>
</template>

<style scoped>
.viewer { background: var(--paper); color: var(--ink); height: 100svh; height: 100dvh; inset: 0; min-height: 100svh; min-height: 100dvh; overflow: hidden; position: fixed; width: 100%; z-index: 30; }
.viewer:fullscreen { height: 100%; min-height: 100%; width: 100%; }
.viewer::backdrop { background: var(--paper); }
.viewer-top { align-items: center; display: flex; justify-content: flex-end; left: 0; padding: calc(13px + env(safe-area-inset-top)) 20px 13px; position: absolute; right: 0; top: 0; z-index: 3; }
.viewer-top-actions { align-items: center; display: flex; gap: 4px; transition: opacity .4s ease, transform .55s cubic-bezier(.22,.61,.36,1); }
.viewer-feedback { color: color-mix(in srgb, var(--ink) 72%, transparent); font-size: 10px; margin-right: 5px; }
.tools-menu { position: relative; }
.more-action, .fullscreen-action, .viewer-close { align-items: center; background: transparent; border-radius: 50%; color: color-mix(in srgb, var(--ink) 58%, transparent); display: inline-flex; height: 38px; justify-content: center; padding: 0; width: 38px; }
.more-action:hover, .fullscreen-action:hover, .viewer-close:hover { background: color-mix(in srgb, var(--ink) 10%, transparent); color: var(--ink); }
.tools-popover { align-items: center; background: color-mix(in srgb, var(--surface) 95%, var(--paper)); border: 1px solid var(--line); border-radius: 7px; box-shadow: var(--shadow); display: flex; gap: 5px; padding: 6px; position: absolute; right: 0; top: calc(100% + 7px); }
.circle-action { align-items: center; background: transparent; border-radius: 50%; color: color-mix(in srgb, var(--ink) 70%, transparent); display: inline-flex; height: 32px; justify-content: center; position: relative; width: 32px; }
.circle-action:hover { background: color-mix(in srgb, var(--ink) 12%, transparent); color: var(--ink); }
.viewer-main { display: flex; flex-direction: column; height: 100%; min-height: 0; }
.viewer-stage { align-items: center; display: flex; flex: 1; justify-content: center; min-height: 0; overflow: hidden; padding: 31px 10vw 91px; touch-action: pan-y; }
.viewer-stage.is-zoomed { cursor: grab; touch-action: none; }
.viewer-stage.is-dragging { cursor: grabbing; }
.viewer-art { align-items: center; display: flex; flex-direction: column; gap: 24px; max-height: 100%; max-width: min(82vw, 1360px); min-height: 0; width: 100%; }
.viewer-caption { color: color-mix(in srgb, var(--ink) 88%, transparent); font-family: Georgia, ui-serif, serif; font-size: 13px; line-height: 1.5; margin: 0; max-height: 1.5em; max-width: min(78vw, 780px); overflow: hidden; text-align: center; text-overflow: ellipsis; white-space: nowrap; transition: max-height .55s cubic-bezier(.22,.61,.36,1), margin .55s cubic-bezier(.22,.61,.36,1), opacity .4s ease, transform .55s cubic-bezier(.22,.61,.36,1); }
.viewer-image { align-items: center; background: var(--surface); box-shadow: var(--shadow); display: flex; justify-content: center; max-height: 100%; max-width: 100%; min-height: 0; transform-origin: center; transition: transform .22s ease-out; will-change: transform; }
.viewer-stage.is-dragging .viewer-image { transition: none; }
.viewer-image img { display: block; height: auto; max-height: calc(100svh - 122px); max-width: 100%; object-fit: contain; user-select: none; width: auto; }
.viewer-stage.has-caption .viewer-image img { max-height: calc(100svh - 165px); }
.viewer.is-zoomed .viewer-caption { margin-bottom: -12px; max-height: 0; opacity: 0; pointer-events: none; transform: translateY(-30px); }
.viewer-info { bottom: 0; left: 0; padding: 0 30px calc(17px + env(safe-area-inset-bottom)); position: absolute; right: 0; transition: opacity .4s ease, transform .55s cubic-bezier(.22,.61,.36,1); }
.viewer-meta { margin: 0 auto; max-width: 980px; position: relative; }
.viewer-info :deep(.meta-row) { border-top-color: var(--line); gap: 24px; margin: 0 auto; max-width: 980px; padding-top: 12px; }
.viewer-info :deep(dt) { color: color-mix(in srgb, var(--ink) 48%, transparent); font-size: 9px; }
.viewer-info :deep(dd) { color: var(--ink); font-size: 12px; font-weight: 700; }
.viewer-nav { align-items: center; background: transparent; border-radius: 0; color: color-mix(in srgb, var(--ink) 55%, transparent); display: inline-flex; height: 54px; justify-content: center; position: fixed; top: 50%; transform: translateY(-50%); transition: opacity .4s ease, transform .55s cubic-bezier(.22,.61,.36,1); width: 54px; z-index: 2; }
.viewer-nav:not(:disabled):hover { background: transparent; color: var(--ink); }
.viewer-nav:disabled { cursor: default; opacity: .22; }
.viewer-nav-left { left: 12px; }.viewer-nav-right { right: 12px; }
.viewer.is-zoomed .viewer-top-actions { opacity: 0; pointer-events: none; transform: translate(30px, -28px); }
.viewer.is-zoomed .viewer-info { opacity: 0; pointer-events: none; transform: translateY(105%); }
.viewer.is-zoomed .viewer-nav-left { opacity: 0; pointer-events: none; transform: translate(-88px, -50%); }
.viewer.is-zoomed .viewer-nav-right { opacity: 0; pointer-events: none; transform: translate(88px, -50%); }
@media (max-width: 680px) {
  .viewer-top { padding: calc(10px + env(safe-area-inset-top)) 12px 10px; }
  .viewer-stage { padding: calc(62px + env(safe-area-inset-top)) 16px calc(103px + env(safe-area-inset-bottom)); }
  .viewer-art { gap: 18px; max-width: 100%; }
  .viewer-caption { font-size: 13px; max-width: 100%; padding: 0 8px; }
  .viewer-image { max-width: 100%; width: 100%; }
  .viewer-image img { max-height: calc(100svh - 224px); width: 100%; }
  .viewer-stage.has-caption .viewer-image img { max-height: calc(100svh - 247px); }
  .viewer-info { padding: 0 16px calc(14px + env(safe-area-inset-bottom)); }
  .viewer-info :deep(.meta-row) { gap: 14px 10px; grid-template-columns: repeat(2, minmax(0, 1fr)); padding-top: 10px; }
  .viewer-nav { display: none; }
}
</style>
