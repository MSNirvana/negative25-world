<script setup lang="ts">
import { computed, ref } from 'vue';
import { RotateCcw, SlidersHorizontal } from 'lucide-vue-next';
import type { SimulatorKind } from '../data/tutorials';
import { useLocale } from '../i18n';

const props = defineProps<{ kind: SimulatorKind; image: string; scene: string; title: string }>();
const { t } = useLocale();
const shutterStops = [1000, 500, 250, 125, 60, 30, 15, 8, 4, 2, 1];
const isoStops = [100, 200, 400, 800, 1600, 3200, 6400, 12800];
const focalStops = [24, 35, 50, 85, 135, 200];
const aperture = ref(2.8);
const shutterIndex = ref(3);
const isoIndex = ref(2);
const compensation = ref(0);
const focusIndex = ref(1);
const focalIndex = ref(2);
const shutter = computed(() => shutterStops[shutterIndex.value] ?? 125);
const iso = computed(() => isoStops[isoIndex.value] ?? 400);
const focal = computed(() => focalStops[focalIndex.value] ?? 50);
const focusLabels = computed(() => [t('tutorials.focusForeground'), t('tutorials.focusSubject'), t('tutorials.focusBackground')]);
const controlTitle = computed(() => ({
  exposure: t('tutorials.simExposure'), aperture: t('tutorials.simAperture'), shutter: t('tutorials.simShutter'),
  iso: t('tutorials.simIso'), compensation: t('tutorials.simCompensation'), focus: t('tutorials.simFocus'), focal: t('tutorials.simFocal'),
}[props.kind]));
function formatShutter(value: number): string { return value > 1 ? `1/${value}s` : '1s'; }
const valueLabel = computed(() => {
  if (props.kind === 'aperture') return `f/${aperture.value}`;
  if (props.kind === 'shutter') return formatShutter(shutter.value);
  if (props.kind === 'iso') return `ISO ${iso.value}`;
  if (props.kind === 'compensation') return `${compensation.value > 0 ? '+' : ''}${compensation.value.toFixed(1)} EV`;
  if (props.kind === 'focus') return focusLabels.value[focusIndex.value] ?? focusLabels.value[1];
  if (props.kind === 'focal') return `${focal.value}mm`;
  return `f/${aperture.value} · ${formatShutter(shutter.value)} · ISO ${iso.value}`;
});
const effect = computed(() => {
  const base = { blur: 0, brightness: 1, noise: 0, motion: 0, focus: 50, focusWidth: 28, zoom: 1 };
  if (props.kind === 'aperture') {
    const depth = Math.max(0, Math.min(1, (16 - aperture.value) / 14.6));
    return { ...base, blur: 0.4 + depth * 9, focusWidth: 58 - depth * 43 };
  }
  if (props.kind === 'shutter') return { ...base, motion: Math.max(0, Math.log2(1000 / shutter.value) * 3.2) };
  if (props.kind === 'iso') {
    const noise = Math.max(0, isoIndex.value / (isoStops.length - 1));
    return { ...base, brightness: 1 + noise * 0.06, noise };
  }
  if (props.kind === 'compensation') return { ...base, brightness: Math.max(0.55, 1 + compensation.value * 0.2) };
  if (props.kind === 'focus') return { ...base, blur: 8.5, focus: 22 + focusIndex.value * 28, focusWidth: 18 };
  if (props.kind === 'focal') return { ...base, zoom: 1 + ((focal.value - 24) / 176) * 0.52 };
  const exposureStops = (-2 * Math.log2(aperture.value / 2.8)) + Math.log2(125 / shutter.value) + Math.log2(iso.value / 400);
  const noise = Math.max(0, (isoIndex.value - 2) / (isoStops.length - 3));
  const motion = Math.max(0, Math.log2(125 / shutter.value) * 2.3);
  return { ...base, brightness: Math.max(0.45, Math.min(1.65, 1 + exposureStops * 0.13)), noise, motion };
});
const previewStyle = computed(() => ({
  '--sim-image': `url("${props.image}")`, '--sim-blur': `${effect.value.blur}px`, '--sim-brightness': String(effect.value.brightness),
  '--sim-noise': String(effect.value.noise), '--sim-motion': `${effect.value.motion}px`, '--sim-motion-opacity': String(Math.min(0.72, effect.value.motion / 24)),
  '--sim-focus': `${effect.value.focus}%`, '--sim-focus-width': `${effect.value.focusWidth}%`, '--sim-zoom': String(effect.value.zoom),
}));
const insight = computed(() => {
  if (props.kind === 'aperture') return aperture.value <= 2.8 ? t('tutorials.insightApertureWide') : t('tutorials.insightApertureNarrow');
  if (props.kind === 'shutter') return shutter.value >= 250 ? t('tutorials.insightShutterFast') : t('tutorials.insightShutterSlow');
  if (props.kind === 'iso') return iso.value <= 400 ? t('tutorials.insightIsoClean') : t('tutorials.insightIsoNoise');
  if (props.kind === 'compensation') return compensation.value < 0 ? t('tutorials.insightCompDark') : compensation.value > 0 ? t('tutorials.insightCompBright') : t('tutorials.insightCompNeutral');
  if (props.kind === 'focus') return t('tutorials.insightFocus', { value: focusLabels.value[focusIndex.value] ?? focusLabels.value[1] });
  if (props.kind === 'focal') return focal.value <= 35 ? t('tutorials.insightFocalWide') : focal.value >= 85 ? t('tutorials.insightFocalTele') : t('tutorials.insightFocalNormal');
  return t('tutorials.insightExposure');
});
function reset(): void { aperture.value = 2.8; shutterIndex.value = 3; isoIndex.value = 2; compensation.value = 0; focusIndex.value = 1; focalIndex.value = 2; }
</script>

<template>
  <section class="tutorial-simulator" :aria-label="title">
    <header class="simulator-heading"><div><span class="simulator-eyebrow"><SlidersHorizontal :size="13" /> {{ t('tutorials.simulation') }}</span><h2>{{ controlTitle }}</h2></div><button class="sim-reset" type="button" :aria-label="t('tutorials.reset')" :title="t('tutorials.reset')" @click="reset"><RotateCcw :size="15" /></button></header>
    <div class="simulator-layout">
      <div class="sim-stage" :style="previewStyle">
        <div class="sim-scene sim-scene-base" /><div v-if="kind === 'aperture' || kind === 'focus'" class="sim-scene sim-scene-depth" />
        <div v-if="kind === 'shutter' || kind === 'exposure'" class="sim-scene sim-scene-motion sim-scene-motion-back" /><div v-if="kind === 'shutter' || kind === 'exposure'" class="sim-scene sim-scene-motion sim-scene-motion-front" />
        <div class="sim-noise" /><span class="sim-stage-label">{{ t('tutorials.preview') }}</span><span class="sim-stage-scene">{{ scene }}</span>
      </div>
      <div class="simulator-controls">
        <div class="sim-current"><span>{{ t('tutorials.current') }}</span><strong data-testid="simulator-current">{{ valueLabel }}</strong></div>
        <label v-if="kind === 'aperture' || kind === 'exposure'" class="sim-control"><span><b>{{ t('tutorials.aperture') }}</b><output>f/{{ aperture }}</output></span><input v-model.number="aperture" type="range" min="1.4" max="16" step="0.1" :aria-label="t('tutorials.aperture')" /><small>f/1.4 <i>f/16</i></small></label>
        <label v-if="kind === 'shutter' || kind === 'exposure'" class="sim-control"><span><b>{{ t('tutorials.shutter') }}</b><output>{{ formatShutter(shutter) }}</output></span><input v-model.number="shutterIndex" type="range" min="0" :max="shutterStops.length - 1" step="1" :aria-label="t('tutorials.shutter')" /><small>1/1000s <i>1s</i></small></label>
        <label v-if="kind === 'iso' || kind === 'exposure'" class="sim-control"><span><b>{{ t('tutorials.iso') }}</b><output>ISO {{ iso }}</output></span><input v-model.number="isoIndex" type="range" min="0" :max="isoStops.length - 1" step="1" :aria-label="t('tutorials.iso')" /><small>100 <i>12800</i></small></label>
        <label v-if="kind === 'compensation'" class="sim-control"><span><b>{{ t('tutorials.ev') }}</b><output>{{ compensation > 0 ? '+' : '' }}{{ compensation.toFixed(1) }} EV</output></span><input v-model.number="compensation" type="range" min="-2" max="2" step="0.5" :aria-label="t('tutorials.ev')" /><small>-2 EV <i>+2 EV</i></small></label>
        <label v-if="kind === 'focus'" class="sim-control"><span><b>{{ t('tutorials.focus') }}</b><output>{{ focusLabels[focusIndex] }}</output></span><input v-model.number="focusIndex" type="range" min="0" max="2" step="1" :aria-label="t('tutorials.focus')" /><small>{{ focusLabels[0] }} <i>{{ focusLabels[2] }}</i></small></label>
        <label v-if="kind === 'focal'" class="sim-control"><span><b>{{ t('tutorials.focal') }}</b><output>{{ focal }}mm</output></span><input v-model.number="focalIndex" type="range" min="0" :max="focalStops.length - 1" step="1" :aria-label="t('tutorials.focal')" /><small>24mm <i>200mm</i></small></label>
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
.sim-reset { align-items: center; background: transparent; border: 1px solid var(--line); border-radius: 50%; color: var(--muted); display: inline-flex; height: 31px; justify-content: center; padding: 0; width: 31px; }
.sim-reset:hover { color: var(--ink); }
.simulator-layout { display: grid; gap: 22px; grid-template-columns: minmax(0, 1.55fr) minmax(230px, .72fr); }
.sim-stage { aspect-ratio: 1.5; background: #111; min-height: 280px; overflow: hidden; position: relative; }
.sim-scene { background: var(--sim-image) center / cover no-repeat; filter: brightness(var(--sim-brightness)); inset: -2%; position: absolute; transform: scale(var(--sim-zoom)); transform-origin: 52% 50%; transition: filter .28s ease, transform .38s ease; }
.sim-scene-depth { filter: brightness(var(--sim-brightness)) blur(var(--sim-blur)); inset: -5%; mask-image: radial-gradient(ellipse var(--sim-focus-width) 58% at var(--sim-focus) 52%, transparent 0 43%, rgba(0,0,0,.3) 57%, #000 78%); transform: scale(calc(var(--sim-zoom) * 1.035)); }
.sim-scene-motion { clip-path: inset(24% 0 19% 0); filter: brightness(var(--sim-brightness)) blur(1.2px); opacity: var(--sim-motion-opacity); }
.sim-scene-motion-back { transform: translateX(calc(var(--sim-motion) * -1)) scale(var(--sim-zoom)); }
.sim-scene-motion-front { transform: translateX(var(--sim-motion)) scale(var(--sim-zoom)); }
.sim-noise { background-image: repeating-radial-gradient(circle at 18% 27%, rgba(255,255,255,.7) 0 1px, rgba(0,0,0,.48) 1px 2px, transparent 2px 4px); inset: 0; mix-blend-mode: soft-light; opacity: calc(var(--sim-noise) * .72); pointer-events: none; position: absolute; transition: opacity .25s ease; }
.sim-stage::after { background: linear-gradient(180deg, rgba(0,0,0,.2), transparent 27%, transparent 70%, rgba(0,0,0,.3)); content: ''; inset: 0; pointer-events: none; position: absolute; }
.sim-stage-label, .sim-stage-scene { color: #fff; font-size: 10px; letter-spacing: .08em; position: absolute; text-shadow: 0 1px 8px rgba(0,0,0,.75); z-index: 3; }
.sim-stage-label { left: 16px; text-transform: uppercase; top: 14px; }
.sim-stage-scene { bottom: 14px; left: 16px; }
.simulator-controls { align-content: center; display: grid; gap: 18px; padding: 8px 0; }
.sim-current { align-items: baseline; border-bottom: 1px solid var(--line); display: flex; gap: 12px; justify-content: space-between; padding-bottom: 12px; }
.sim-current span { color: var(--muted); flex: 0 0 auto; font-size: 11px; }
.sim-current strong { font-family: Georgia, ui-serif, serif; font-size: 16px; font-weight: 500; text-align: right; }
.sim-control { display: grid; gap: 9px; }
.sim-control > span { align-items: baseline; display: flex; justify-content: space-between; }
.sim-control b { font-size: 12px; font-weight: 600; }
.sim-control output { color: var(--accent-deep); font-family: Georgia, ui-serif, serif; font-size: 16px; }
.sim-control input { accent-color: var(--accent-deep); min-width: 0; width: 100%; }
.sim-control small { color: var(--muted); display: flex; font-size: 10px; justify-content: space-between; }
.sim-control small i { font-style: normal; }
.sim-insight { align-items: baseline; border-top: 1px solid var(--line); display: flex; gap: 12px; margin-top: 18px; padding: 14px 0 17px; }
.sim-insight span { color: var(--muted); flex: 0 0 auto; font-size: 10px; letter-spacing: .08em; text-transform: uppercase; }
.sim-insight p { font-family: Georgia, ui-serif, serif; font-size: 15px; line-height: 1.45; margin: 0; }
@media (max-width: 760px) { .simulator-layout { display: flex; flex-direction: column; } .sim-stage { min-height: 0; width: 100%; } .simulator-controls { padding: 3px 0 8px; } .sim-insight { display: block; } .sim-insight span { display: block; margin-bottom: 6px; } }
</style>
