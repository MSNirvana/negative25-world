<script setup lang="ts">
import { computed, ref } from 'vue';
import { RotateCcw, SlidersHorizontal } from 'lucide-vue-next';
import type { SimulatorKind } from '../data/tutorials';
import { useLocale } from '../i18n';

defineOptions({ name: 'TutorialSimulator' });

const props = defineProps<{ kind: SimulatorKind; image: string; scene: string; title: string }>();
const { locale, t } = useLocale();
const scenes = [
  { id: 'portrait', zh: '窗边人像', en: 'Window portrait', image: '/tutorials/scenes/scene-portrait.jpg' },
  { id: 'landscape', zh: '山谷风景', en: 'Mountain valley', image: '/tutorials/scenes/mountain-valley.jpg' },
  { id: 'street', zh: '夜间车流', en: 'Night traffic', image: '/tutorials/scenes/scene-traffic.jpg' },
  { id: 'water', zh: '溪流与水面', en: 'Stream and water', image: '/tutorials/scenes/scene-water.jpg' },
];
const shutterStops = [1000, 500, 250, 125, 60, 30, 15, 8, 4, 2, 1];
const isoStops = [100, 200, 400, 800, 1600, 3200, 6400, 12800];
const focalStops = [14, 24, 35, 50, 85, 105, 200];
const sceneId = ref('portrait');
const aperture = ref(2.8);
const shutterIndex = ref(3);
const isoIndex = ref(2);
const compensation = ref(0);
const focalIndex = ref(3);
const focusPosition = ref(50);
const whiteBalance = ref(5200);
const showReference = ref(false);
const shutter = computed(() => shutterStops[shutterIndex.value] ?? 125);
const iso = computed(() => isoStops[isoIndex.value] ?? 400);
const focal = computed(() => focalStops[focalIndex.value] ?? 50);
const selectedScene = computed(() => scenes.find((scene) => scene.id === sceneId.value) ?? scenes[0]);
const sceneLabel = computed(() => locale.value === 'en' ? selectedScene.value.en : selectedScene.value.zh);
function formatShutter(value: number): string { return value > 1 ? `1/${value}s` : '1s'; }
function clamp(value: number, min: number, max: number): number { return Math.max(min, Math.min(max, value)); }
const exposureStops = computed(() => (-2 * Math.log2(aperture.value / 2.8)) + Math.log2(125 / shutter.value) + Math.log2(iso.value / 400) + compensation.value);
const effects = computed(() => {
  const depth = clamp((16 - aperture.value) / 14.6, 0, 1);
  const noise = clamp((isoIndex.value - 2) / (isoStops.length - 3), 0, 1);
  return {
    brightness: clamp(1 + exposureStops.value * 0.14, 0.42, 1.7), blur: 0.5 + depth * 8.5, focusWidth: 12 + (1 - depth) * 52,
    motion: Math.max(0, Math.log2(125 / shutter.value) * 3.3), noise, zoom: 1 + ((focal.value - 14) / 186) * 0.55,
    temperature: clamp((whiteBalance.value - 5200) / 2400, -1, 1),
  };
});
const previewStyle = computed(() => ({
  '--lab-image': `url("${selectedScene.value.image}")`, '--lab-fallback-image': `url("${props.image}")`, '--lab-brightness': String(effects.value.brightness),
  '--lab-blur': `${effects.value.blur}px`, '--lab-focus': `${focusPosition.value}%`, '--lab-focus-width': `${effects.value.focusWidth}%`,
  '--lab-motion': `${effects.value.motion}px`, '--lab-motion-opacity': String(Math.min(0.72, effects.value.motion / 24)), '--lab-noise': String(effects.value.noise),
  '--lab-zoom': String(effects.value.zoom), '--lab-temperature': String(effects.value.temperature),
}));
const valueLabel = computed(() => `f/${aperture.value} · ${formatShutter(shutter.value)} · ISO ${iso.value}`);
const insight = computed(() => {
  if (effects.value.noise > 0.65) return t('tutorials.labInsightNoise');
  if (effects.value.motion > 8) return t('tutorials.labInsightMotion');
  if (effects.value.blur > 5) return t('tutorials.labInsightDepth');
  if (effects.value.temperature > 0.35) return t('tutorials.labInsightWarm');
  if (effects.value.temperature < -0.35) return t('tutorials.labInsightCool');
  return t('tutorials.labInsightBalanced');
});
function reset(): void {
  sceneId.value = 'portrait'; aperture.value = 2.8; shutterIndex.value = 3; isoIndex.value = 2; compensation.value = 0;
  focalIndex.value = 3; focusPosition.value = 50; whiteBalance.value = 5200; showReference.value = false;
}
</script>

<template>
  <section class="tutorial-simulator" :aria-label="title" :data-kind="props.kind">
    <header class="simulator-heading"><div><span class="simulator-eyebrow"><SlidersHorizontal :size="13" /> {{ t('tutorials.simulation') }}</span><h2>{{ t('tutorials.basicLabTitle') }}</h2></div><div class="simulator-actions"><button class="sim-reference" type="button" :class="{ active: showReference }" @click="showReference = !showReference">{{ t('tutorials.referenceFrame') }}</button><button class="sim-reset" type="button" :aria-label="t('tutorials.reset')" :title="t('tutorials.reset')" @click="reset"><RotateCcw :size="15" /></button></div></header>
    <div class="scene-switcher" role="tablist" :aria-label="t('tutorials.labScenes')"><button v-for="sceneOption in scenes" :key="sceneOption.id" type="button" role="tab" :aria-selected="sceneId === sceneOption.id" :class="{ active: sceneId === sceneOption.id }" @click="sceneId = sceneOption.id">{{ locale === 'en' ? sceneOption.en : sceneOption.zh }}</button></div>
    <div class="simulator-layout">
      <div class="sim-stage" :style="previewStyle"><div class="sim-scene sim-scene-base" :class="{ reference: showReference }" /><div v-if="!showReference" class="sim-scene sim-scene-depth" /><div v-if="!showReference" class="sim-scene sim-scene-motion sim-scene-motion-back" /><div v-if="!showReference" class="sim-scene sim-scene-motion sim-scene-motion-front" /><div v-if="!showReference" class="sim-temperature" /><div v-if="!showReference" class="sim-noise" /><span class="sim-stage-label">{{ showReference ? t('tutorials.referenceFrame') : t('tutorials.preview') }}</span><span class="sim-stage-scene">{{ sceneLabel }}</span></div>
      <div class="simulator-controls">
        <div class="sim-current"><span>{{ t('tutorials.current') }}</span><strong data-testid="simulator-current">{{ valueLabel }}</strong></div>
        <label class="sim-control"><span><b>{{ t('tutorials.aperture') }}</b><output>f/{{ aperture }}</output></span><input v-model.number="aperture" type="range" min="1.4" max="16" step="0.1" :aria-label="t('tutorials.aperture')" /><small>f/1.4 <i>f/16</i></small></label>
        <label class="sim-control"><span><b>{{ t('tutorials.shutter') }}</b><output>{{ formatShutter(shutter) }}</output></span><input v-model.number="shutterIndex" type="range" min="0" :max="shutterStops.length - 1" step="1" :aria-label="t('tutorials.shutter')" /><small>1/1000s <i>1s</i></small></label>
        <label class="sim-control"><span><b>{{ t('tutorials.iso') }}</b><output>ISO {{ iso }}</output></span><input v-model.number="isoIndex" type="range" min="0" :max="isoStops.length - 1" step="1" :aria-label="t('tutorials.iso')" /><small>100 <i>12800</i></small></label>
        <label class="sim-control"><span><b>{{ t('tutorials.ev') }}</b><output>{{ compensation > 0 ? '+' : '' }}{{ compensation.toFixed(1) }} EV</output></span><input v-model.number="compensation" type="range" min="-2" max="2" step="0.5" :aria-label="t('tutorials.ev')" /><small>-2 EV <i>+2 EV</i></small></label>
        <label class="sim-control"><span><b>{{ t('tutorials.focal') }}</b><output>{{ focal }}mm</output></span><input v-model.number="focalIndex" type="range" min="0" :max="focalStops.length - 1" step="1" :aria-label="t('tutorials.focal')" /><small>14mm <i>200mm</i></small></label>
        <label class="sim-control"><span><b>{{ t('tutorials.focus') }}</b><output>{{ focusPosition }}%</output></span><input v-model.number="focusPosition" type="range" min="8" max="92" step="1" :aria-label="t('tutorials.focus')" /><small>{{ t('tutorials.focusForeground') }} <i>{{ t('tutorials.focusBackground') }}</i></small></label>
        <label class="sim-control"><span><b>{{ t('tutorials.whiteBalance') }}</b><output>{{ whiteBalance }}K</output></span><input v-model.number="whiteBalance" type="range" min="2800" max="7500" step="100" :aria-label="t('tutorials.whiteBalance')" /><small>2800K <i>7500K</i></small></label>
      </div>
    </div>
    <div class="sim-insight"><span>{{ t('tutorials.youSee') }}</span><p>{{ insight }}</p></div>
  </section>
</template>

<style scoped>
.tutorial-simulator { background: var(--surface); border-bottom: 1px solid var(--line); border-top: 1px solid var(--line); margin: 34px 0 0; }
.simulator-heading { align-items: center; display: flex; justify-content: space-between; padding: 18px 0 15px; }
.simulator-eyebrow { align-items: center; color: var(--muted); display: inline-flex; font-size: 10px; gap: 6px; letter-spacing: .1em; text-transform: uppercase; }
.simulator-heading h2 { font-family: Georgia, ui-serif, serif; font-size: 24px; font-weight: 500; line-height: 1.2; margin: 7px 0 0; }
.simulator-actions { align-items: center; display: flex; gap: 9px; }
.sim-reference { background: transparent; border: 1px solid var(--line); border-radius: 999px; color: var(--muted); font-size: 11px; padding: 7px 10px; }
.sim-reference.active, .sim-reference:hover { background: var(--surface-soft); color: var(--ink); }
.sim-reset { align-items: center; background: transparent; border: 1px solid var(--line); border-radius: 50%; color: var(--muted); display: inline-flex; height: 31px; justify-content: center; padding: 0; width: 31px; }
.sim-reset:hover { color: var(--ink); }
.scene-switcher { border-bottom: 1px solid var(--line); display: flex; gap: 5px; overflow-x: auto; padding-bottom: 13px; scrollbar-width: none; }
.scene-switcher::-webkit-scrollbar { display: none; }
.scene-switcher button { background: transparent; border: 1px solid transparent; border-radius: 999px; color: var(--muted); flex: 0 0 auto; font-size: 11px; padding: 7px 11px; }
.scene-switcher button.active, .scene-switcher button:hover { background: var(--surface-soft); border-color: var(--line); color: var(--ink); }
.simulator-layout { display: grid; gap: 24px; grid-template-columns: minmax(0, 1.35fr) minmax(310px, .9fr); padding-top: 18px; }
.sim-stage { aspect-ratio: 1.5; background: #111; min-height: 300px; overflow: hidden; position: relative; }
.sim-scene { background: var(--lab-image) center / cover no-repeat; filter: brightness(var(--lab-brightness)); inset: -2%; position: absolute; transform: scale(var(--lab-zoom)); transform-origin: 50% 50%; transition: filter .28s ease, transform .38s ease; }
.sim-scene-base.reference { filter: none; transform: scale(1); }
.sim-scene-depth { filter: brightness(var(--lab-brightness)) blur(var(--lab-blur)); inset: -5%; mask-image: radial-gradient(ellipse var(--lab-focus-width) 62% at var(--lab-focus) 50%, transparent 0 40%, rgba(0,0,0,.28) 57%, #000 80%); transform: scale(calc(var(--lab-zoom) * 1.04)); }
.sim-scene-motion { clip-path: inset(20% 0 17% 0); filter: brightness(var(--lab-brightness)) blur(1.1px); opacity: var(--lab-motion-opacity); }
.sim-scene-motion-back { transform: translateX(calc(var(--lab-motion) * -1)) scale(var(--lab-zoom)); }
.sim-scene-motion-front { transform: translateX(var(--lab-motion)) scale(var(--lab-zoom)); }
.sim-temperature { background: linear-gradient(90deg, rgba(44,128,255,calc(max(0, var(--lab-temperature)) * .12)), transparent 45%, rgba(255,132,48,calc(max(0, calc(var(--lab-temperature) * -1)) * .16))); inset: 0; mix-blend-mode: color; pointer-events: none; position: absolute; }
.sim-noise { background-image: repeating-radial-gradient(circle at 18% 27%, rgba(255,255,255,.72) 0 1px, rgba(0,0,0,.52) 1px 2px, transparent 2px 4px); inset: 0; mix-blend-mode: soft-light; opacity: calc(var(--lab-noise) * .72); pointer-events: none; position: absolute; transition: opacity .25s ease; }
.sim-stage::after { background: linear-gradient(180deg, rgba(0,0,0,.2), transparent 27%, transparent 70%, rgba(0,0,0,.34)); content: ''; inset: 0; pointer-events: none; position: absolute; }
.sim-stage-label, .sim-stage-scene { color: #fff; font-size: 10px; letter-spacing: .08em; position: absolute; text-shadow: 0 1px 8px rgba(0,0,0,.75); z-index: 3; }
.sim-stage-label { left: 16px; text-transform: uppercase; top: 14px; }
.sim-stage-scene { bottom: 14px; left: 16px; }
.simulator-controls { align-content: center; display: grid; gap: 15px 18px; grid-template-columns: repeat(2, minmax(0, 1fr)); padding: 5px 0; }
.sim-current { align-items: baseline; border-bottom: 1px solid var(--line); display: flex; gap: 10px; grid-column: 1 / -1; justify-content: space-between; padding-bottom: 12px; }
.sim-current span { color: var(--muted); flex: 0 0 auto; font-size: 11px; }
.sim-current strong { font-family: Georgia, ui-serif, serif; font-size: 15px; font-weight: 500; text-align: right; }
.sim-control { display: grid; gap: 8px; min-width: 0; }
.sim-control > span { align-items: baseline; display: flex; gap: 5px; justify-content: space-between; }
.sim-control b { font-size: 11px; font-weight: 600; }
.sim-control output { color: var(--accent-deep); font-family: Georgia, ui-serif, serif; font-size: 14px; white-space: nowrap; }
.sim-control input { accent-color: var(--accent-deep); min-width: 0; width: 100%; }
.sim-control small { color: var(--muted); display: flex; font-size: 9px; justify-content: space-between; }
.sim-control small i { font-style: normal; }
.sim-insight { align-items: baseline; border-top: 1px solid var(--line); display: flex; gap: 12px; margin-top: 18px; padding: 14px 0 17px; }
.sim-insight span { color: var(--muted); flex: 0 0 auto; font-size: 10px; letter-spacing: .08em; text-transform: uppercase; }
.sim-insight p { font-family: Georgia, ui-serif, serif; font-size: 15px; line-height: 1.45; margin: 0; }
@media (max-width: 900px) { .simulator-layout { grid-template-columns: minmax(0, 1fr); } .simulator-controls { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (max-width: 640px) { .simulator-heading { align-items: flex-start; gap: 14px; } .simulator-actions { flex: 0 0 auto; } .sim-reference { font-size: 10px; padding: 6px 8px; } .simulator-layout { display: flex; flex-direction: column; } .sim-stage { min-height: 0; width: 100%; } .simulator-controls { grid-template-columns: repeat(2, minmax(0, 1fr)); padding: 3px 0 8px; } .sim-insight { display: block; } .sim-insight span { display: block; margin-bottom: 6px; } }
</style>
