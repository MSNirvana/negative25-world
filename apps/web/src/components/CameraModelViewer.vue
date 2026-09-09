<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';

const props = defineProps<{
  label: string;
  fallbackSrc: string;
}>();

const modelUrl = 'https://sketchfab.com/models/93775837f09141fd91bf1b41a0c0953e/embed?autostart=1&internal=1&tracking=0&ui_ar=0&ui_infos=0&ui_snapshots=0&ui_theatre=0&ui_vr=0&ui_watermark=0&ui_watermark_link=0&ui_hint=0&ui_controls=0&ui_fullscreen=0&dnt=1&transparent=1';
const modelPageUrl = 'https://sketchfab.com/3d-models/nikon-z6-with-nikkor-24-70-f4-93775837f09141fd91bf1b41a0c0953e';
const ready = ref(false);
const failed = ref(false);
const showModel = ref(false);
let loadHandler: (() => void) | null = null;

function startModelLoad(): void {
  showModel.value = true;
}

onMounted(() => {
  // Do not let a third-party iframe delay the document's own load event.
  // This keeps the poster instant while the interactive model starts just
  // after the page is ready.
  if (document.readyState === 'complete') {
    window.setTimeout(startModelLoad, 0);
    return;
  }
  loadHandler = startModelLoad;
  window.addEventListener('load', loadHandler, { once: true });
});

onBeforeUnmount(() => {
  if (loadHandler) window.removeEventListener('load', loadHandler);
});

function markReady(): void {
  ready.value = true;
}

function markFailed(): void {
  failed.value = true;
}

</script>

<template>
  <div
    class="camera-model-viewer"
    data-testid="camera-360"
    data-rendered="true"
    data-interacted="true"
  >
    <img class="camera-poster" :src="props.fallbackSrc" :alt="props.label" :class="{ hidden: ready && !failed }" />
    <iframe
      v-if="showModel && !failed"
      class="camera-model-frame"
      :class="{ loaded: ready }"
      :src="modelUrl"
      :title="props.label"
      loading="eager"
      allow="autoplay; fullscreen; xr-spatial-tracking"
      referrerpolicy="strict-origin-when-cross-origin"
      @load="markReady"
      @error="markFailed"
    />
    <div class="camera-credit" aria-label="3D 模型署名">
      <span>Nikon Z6 · NIKKOR 24–70mm f/4</span>
      <a :href="modelPageUrl" target="_blank" rel="noopener noreferrer">3D model by Metazeon · CC BY 4.0</a>
    </div>
  </div>
</template>

<style scoped>
.camera-model-viewer {
  background: transparent;
  height: 100%;
  min-height: 370px;
  overflow: hidden;
  position: relative;
  width: 100%;
}
.camera-model-frame,
.camera-poster {
  border: 0;
  display: block;
  height: 100%;
  inset: 0;
  object-fit: contain;
  position: absolute;
  width: 100%;
}
.camera-model-frame {
  background: transparent;
  opacity: 0;
  transition: opacity .45s ease;
}
.camera-model-frame.loaded { opacity: 1; }
.camera-poster {
  opacity: 1;
  padding: 24px;
  transition: opacity .45s ease;
}
.camera-poster.hidden { opacity: 0; pointer-events: none; }
.camera-credit {
  align-items: flex-end;
  bottom: 12px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  pointer-events: none;
  position: absolute;
  right: 16px;
  text-align: right;
  z-index: 2;
}
.camera-credit span,
.camera-credit a {
  background: rgba(15, 15, 16, .68);
  color: rgba(255, 255, 255, .72);
  font-size: 9px;
  line-height: 1.35;
  padding: 3px 5px;
}
.camera-credit a { pointer-events: auto; text-decoration: none; }
.camera-credit a:hover { color: #fff; }
@media (prefers-reduced-motion: reduce) {
  .camera-model-frame,
  .camera-poster { transition: none; }
}
@media (max-width: 640px) {
  .camera-model-viewer { min-height: 250px; }
  .camera-poster { padding: 10px; }
  .camera-credit { bottom: 8px; right: 8px; }
  .camera-credit span,
  .camera-credit a { font-size: 8px; }
}
</style>
