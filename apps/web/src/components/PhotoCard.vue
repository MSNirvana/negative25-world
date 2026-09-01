<script setup lang="ts">
import { ref } from 'vue';
import type { GalleryPhoto } from '../stores/gallery';
import { useLocale } from '../i18n';
const props = defineProps<{ photo: GalleryPhoto }>();
defineEmits<{ (event: 'open', photo: GalleryPhoto): void }>();
const { t } = useLocale();
const tilt = ref({ x: 0, y: 0, glareX: 50, glareY: 50 });
function move(event: PointerEvent): void {
  if (event.pointerType === 'touch') return;
  const target = event.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width;
  const y = (event.clientY - rect.top) / rect.height;
  tilt.value = { x: (0.5 - y) * 5, y: (x - 0.5) * 5, glareX: x * 100, glareY: y * 100 };
}
function reset(): void { tilt.value = { x: 0, y: 0, glareX: 50, glareY: 50 }; }
</script>

<template>
  <article class="photo-card" @click="$emit('open', props.photo)">
    <button class="image-wrap" :style="{ '--tilt-x': `${tilt.x}deg`, '--tilt-y': `${tilt.y}deg`, '--glare-x': `${tilt.glareX}%`, '--glare-y': `${tilt.glareY}%`, '--photo-ratio': photo.aspectRatio, backgroundColor: photo.tone }" :aria-label="t('photo.open', { title: photo.title })" @pointermove="move" @pointerleave="reset">
      <img :src="photo.image" :alt="photo.title" loading="lazy" decoding="async" />
      <span class="card-glare" aria-hidden="true"></span>
    </button>
    <div class="card-copy" aria-hidden="true"><h2>{{ photo.title }}</h2><p>{{ photo.caption }}</p><span>{{ photo.location }} · {{ photo.capturedAt }}</span></div>
  </article>
</template>

<style scoped>
.photo-card { min-width: 0; perspective: 1000px; }
.image-wrap { appearance: none; aspect-ratio: var(--photo-ratio); border-radius: 2px; box-shadow: 0 12px 30px rgba(0,0,0,.35), 0 6px 12px rgba(0,0,0,.2); display: block; overflow: hidden; padding: 0; position: relative; transform: perspective(1000px) rotateX(var(--tilt-x)) rotateY(var(--tilt-y)); transform-style: preserve-3d; transition: transform .45s cubic-bezier(.2,.7,.2,1), box-shadow .45s ease; width: 100%; }
.image-wrap:hover, .image-wrap:focus-visible { box-shadow: 0 18px 34px rgba(0,0,0,.44), 0 8px 14px rgba(0,0,0,.28); }
.image-wrap img { display: block; height: 100%; inset: 0; object-fit: cover; position: absolute; transition: transform .7s cubic-bezier(.2,.7,.2,1), opacity .35s ease; width: 100%; }
.photo-card:hover .image-wrap img, .image-wrap:focus-visible img { transform: scale(1.025); }
.card-glare { background: radial-gradient(circle at var(--glare-x) var(--glare-y), rgba(255,255,255,.23), transparent 40%); inset: 0; opacity: 0; pointer-events: none; position: absolute; transition: opacity .25s ease; }
.image-wrap:hover .card-glare, .image-wrap:focus-visible .card-glare { opacity: 1; }
.card-copy { height: 1px; overflow: hidden; position: absolute; width: 1px; clip: rect(0 0 0 0); }
@media (max-width: 960px) { .image-wrap { transform: none; } }
@media (max-width: 580px) { .image-wrap { border-radius: 0; box-shadow: none; } .card-glare { display: none; } }
</style>
