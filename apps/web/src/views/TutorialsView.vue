<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';
import { ArrowLeft, ArrowUpRight, BookOpen, ChevronRight, Clock3, Lightbulb, RotateCcw } from 'lucide-vue-next';
import { useRoute, useRouter } from 'vue-router';
import TutorialSimulator from '../components/TutorialSimulator.vue';
import { categoryLabel, formatLabel, localized, tutorials, type TutorialCategory, type TutorialLocale } from '../data/tutorials';
import { useLocale } from '../i18n';

defineOptions({ name: 'TutorialsView' });

const route = useRoute();
const router = useRouter();
const { locale, t } = useLocale();
const activeCategory = computed<TutorialCategory | 'all'>(() => {
  const value = typeof route.query.category === 'string' ? route.query.category : 'all';
  return value === 'basic' || value === 'equipment' || value === 'advanced' ? value : 'all';
});
const selectedTutorial = computed(() => {
  const slug = typeof route.params.slug === 'string' ? route.params.slug : '';
  return tutorials.find((tutorial) => tutorial.slug === slug) ?? null;
});
const pageLocale = computed<TutorialLocale>(() => locale.value);
const categories: TutorialCategory[] = ['basic', 'equipment', 'advanced'];
const categorySections = computed(() => (['basic', 'equipment', 'advanced'] as TutorialCategory[]).map((category) => ({ category, items: tutorials.filter((tutorial) => tutorial.category === category) })));
const filteredTutorials = computed(() => activeCategory.value === 'all' ? tutorials : tutorials.filter((tutorial) => tutorial.category === activeCategory.value));
const relatedTutorials = computed(() => selectedTutorial.value ? tutorials.filter((tutorial) => tutorial.slug !== selectedTutorial.value?.slug && tutorial.category === selectedTutorial.value?.category).slice(0, 3) : []);

function text(value: { zh: string; en: string }): string { return localized(value, pageLocale.value); }
function chooseCategory(category: TutorialCategory): void {
  void router.replace({ name: 'tutorials', query: { category } });
}
function openTutorial(slug: string): void { void router.push({ name: 'tutorial-detail', params: { slug } }); }
function backToIndex(): void { void router.push({ name: 'tutorials', query: activeCategory.value === 'all' ? {} : { category: activeCategory.value } }); }
function formatDifficulty(value: 'beginner' | 'starter'): string { return value === 'beginner' ? t('tutorials.beginner') : t('tutorials.starter'); }

watch(() => route.params.slug, () => { if (selectedTutorial.value) window.scrollTo({ top: 0, behavior: 'smooth' }); });
onMounted(() => { if (selectedTutorial.value) window.scrollTo({ top: 0, behavior: 'auto' }); });
</script>

<template>
  <main class="tutorial-page page-frame">
    <template v-if="selectedTutorial">
      <article class="tutorial-detail">
        <button class="tutorial-back" type="button" @click="backToIndex"><ArrowLeft :size="15" /> {{ t('tutorials.back') }}</button>
        <header class="detail-header">
          <div class="detail-kicker"><span>{{ categoryLabel(selectedTutorial.category, pageLocale) }}</span><span>{{ formatLabel(selectedTutorial.format, pageLocale) }}</span><span><Clock3 :size="12" /> {{ selectedTutorial.readTime }} {{ t('tutorials.minutes') }}</span></div>
          <h1>{{ text(selectedTutorial.title) }}</h1>
          <p>{{ text(selectedTutorial.summary) }}</p>
        </header>

        <div class="detail-layout">
          <div class="detail-main">
            <figure class="detail-hero">
              <img :src="selectedTutorial.hero" :alt="text(selectedTutorial.scene)" />
              <figcaption><span>{{ t('tutorials.scene') }}</span>{{ text(selectedTutorial.scene) }}</figcaption>
            </figure>

            <section class="takeaway-block">
              <Lightbulb :size="18" />
              <div><span>{{ t('tutorials.takeaway') }}</span><p>{{ text(selectedTutorial.takeaway) }}</p></div>
            </section>

            <TutorialSimulator v-if="selectedTutorial.simulator" :kind="selectedTutorial.simulator" :image="selectedTutorial.hero" :scene="text(selectedTutorial.scene)" :title="text(selectedTutorial.title)" />

            <section class="detail-section">
              <div class="section-label"><span>01</span><h2>{{ t('tutorials.principle') }}</h2></div>
              <p class="detail-lead">{{ text(selectedTutorial.takeaway) }}</p>
              <p>{{ t('tutorials.principleBody') }}</p>
            </section>

            <section class="detail-section">
              <div class="section-label"><span>02</span><h2>{{ t('tutorials.steps') }}</h2></div>
              <ol class="step-list"><li v-for="(step, index) in selectedTutorial.steps" :key="index"><span>{{ String(index + 1).padStart(2, '0') }}</span><p>{{ text(step) }}</p></li></ol>
            </section>

            <section class="case-study">
              <div class="section-label"><span>03</span><h2>{{ t('tutorials.realCase') }}</h2></div>
              <div class="case-layout">
                <figure><img :src="selectedTutorial.caseStudy.image" :alt="text(selectedTutorial.caseStudy.title)" /><figcaption>{{ text(selectedTutorial.caseStudy.title) }}</figcaption></figure>
                <div class="case-copy"><h3>{{ text(selectedTutorial.caseStudy.title) }}</h3><p>{{ text(selectedTutorial.caseStudy.text) }}</p><dl><div v-for="parameter in selectedTutorial.caseStudy.parameters" :key="parameter.value"><dt>{{ text(parameter.label) }}</dt><dd>{{ parameter.value }}</dd></div></dl></div>
              </div>
            </section>

            <section class="detail-section mistakes-section">
              <div class="section-label"><span>04</span><h2>{{ t('tutorials.mistakes') }}</h2></div>
              <ul class="mistake-list"><li v-for="(mistake, index) in selectedTutorial.mistakes" :key="index"><span>×</span>{{ text(mistake) }}</li></ul>
            </section>
          </div>

          <aside class="detail-aside">
            <div class="parameter-block"><span class="aside-label">{{ t('tutorials.parameters') }}</span><dl><div v-for="parameter in selectedTutorial.parameters" :key="parameter.value"><dt>{{ text(parameter.label) }}</dt><dd>{{ parameter.value }}</dd></div></dl></div>
            <div class="suggestion-block"><span class="aside-label">{{ t('tutorials.suggestion') }}</span><p>{{ t('tutorials.suggestionBody') }}</p></div>
            <button class="aside-reset" type="button" @click="backToIndex"><RotateCcw :size="14" /> {{ t('tutorials.backToLibrary') }}</button>
          </aside>
        </div>

        <section v-if="relatedTutorials.length" class="related-section">
          <div class="related-heading"><div><span class="eyebrow">{{ t('tutorials.related') }}</span><h2>{{ t('tutorials.keepExploring') }}</h2></div><button type="button" @click="backToIndex">{{ t('tutorials.backToLibrary') }} <ArrowUpRight :size="14" /></button></div>
          <div class="related-grid"><button v-for="tutorial in relatedTutorials" :key="tutorial.slug" class="tutorial-card" type="button" @click="openTutorial(tutorial.slug)"><span class="card-image"><img :src="tutorial.hero" :alt="text(tutorial.title)" loading="lazy" /></span><span class="card-copy"><span class="card-meta">{{ formatLabel(tutorial.format, pageLocale) }} · {{ tutorial.readTime }}{{ t('tutorials.minutes') }}</span><strong>{{ text(tutorial.title) }}</strong><small>{{ text(tutorial.summary) }}</small></span><ChevronRight :size="16" /></button></div>
        </section>
      </article>
    </template>

    <template v-else>
      <header class="tutorial-intro">
        <div class="intro-copy"><span class="eyebrow"><BookOpen :size="13" /> {{ t('tutorials.eyebrow') }}</span><h1 :aria-label="t('tutorials.title')"><span>{{ t('tutorials.titleLead') }}</span><span>{{ t('tutorials.titleTail') }}</span></h1><p>{{ t('tutorials.description') }}</p></div>
        <div class="intro-image"><img src="/tutorials/nikon-z6iii-cutout.png" :alt="t('tutorials.imageAlt')" /></div>
      </header>

      <nav class="tutorial-filters" :aria-label="t('tutorials.categories')">
        <button v-for="category in categories" :key="category" type="button" :class="{ active: activeCategory === category }" @click="chooseCategory(category)">{{ categoryLabel(category, pageLocale) }}<span>{{ tutorials.filter((item) => item.category === category).length }}</span></button>
      </nav>

      <section class="tutorial-library">
        <template v-if="activeCategory === 'all'">
          <section v-for="section in categorySections" :key="section.category" class="library-section"><div class="library-heading"><div><span class="eyebrow">{{ categoryLabel(section.category, pageLocale) }}</span><h2>{{ t(`tutorials.${section.category}Title`) }}</h2></div><span>{{ section.items.length }} {{ t('tutorials.items') }}</span></div><div class="tutorial-grid"><button v-for="tutorial in section.items" :key="tutorial.slug" class="tutorial-card" type="button" @click="openTutorial(tutorial.slug)"><span class="card-image"><img :src="tutorial.hero" :alt="text(tutorial.title)" loading="lazy" /></span><span class="card-copy"><span class="card-meta">{{ formatLabel(tutorial.format, pageLocale) }} · {{ formatDifficulty(tutorial.difficulty) }}</span><strong>{{ text(tutorial.title) }}</strong><small>{{ text(tutorial.summary) }}</small></span><ChevronRight :size="16" /></button></div></section>
        </template>
        <section v-else class="library-section filtered-section"><div class="library-heading"><div><span class="eyebrow">{{ categoryLabel(activeCategory, pageLocale) }}</span><h2>{{ t(`tutorials.${activeCategory}Title`) }}</h2></div><span>{{ filteredTutorials.length }} {{ t('tutorials.items') }}</span></div><div class="tutorial-grid"><button v-for="tutorial in filteredTutorials" :key="tutorial.slug" class="tutorial-card" type="button" @click="openTutorial(tutorial.slug)"><span class="card-image"><img :src="tutorial.hero" :alt="text(tutorial.title)" loading="lazy" /></span><span class="card-copy"><span class="card-meta">{{ formatLabel(tutorial.format, pageLocale) }} · {{ formatDifficulty(tutorial.difficulty) }}</span><strong>{{ text(tutorial.title) }}</strong><small>{{ text(tutorial.summary) }}</small></span><ChevronRight :size="16" /></button></div></section>
      </section>
    </template>
  </main>
</template>

<style scoped>
.tutorial-page { padding-bottom: 110px; }
.tutorial-intro { align-items: stretch; border-bottom: 1px solid var(--line); display: grid; gap: 52px; grid-template-columns: minmax(0, .86fr) minmax(0, 1.14fr); margin-top: 42px; padding-bottom: 52px; }
.intro-copy { align-self: center; max-width: 470px; padding: 28px 0; }
.eyebrow { align-items: center; color: var(--muted); display: inline-flex; font-size: 10px; font-weight: 650; gap: 7px; letter-spacing: .12em; text-transform: uppercase; }
.intro-copy h1 { font-family: Georgia, ui-serif, serif; font-size: clamp(44px, 5.2vw, 68px); font-weight: 500; letter-spacing: 0; line-height: 1.02; margin: 18px 0 22px; }
.intro-copy h1 span { display: block; white-space: nowrap; }
.intro-copy p { color: var(--muted); font-size: 16px; line-height: 1.75; margin: 0; max-width: 390px; }
.intro-image { align-items: center; display: flex; justify-content: center; min-height: 370px; overflow: hidden; }
.intro-image img { display: block; height: auto; max-height: 350px; object-fit: contain; width: min(92%, 610px); }
.tutorial-filters { align-items: center; border-bottom: 1px solid var(--line); display: flex; gap: 5px; overflow-x: auto; padding: 18px 0; scrollbar-width: none; }
.tutorial-filters::-webkit-scrollbar { display: none; }
.tutorial-filters button { align-items: center; background: transparent; border: 1px solid transparent; border-radius: 999px; color: var(--muted); display: inline-flex; flex: 0 0 auto; font-size: 12px; gap: 7px; padding: 8px 12px; }
.tutorial-filters button span { color: inherit; font-size: 10px; }
.tutorial-filters button:hover, .tutorial-filters button.active { background: var(--surface-soft); border-color: var(--line); color: var(--ink); }
.tutorial-library { scroll-margin-top: 24px; }
.library-section { padding: 48px 0 0; }
.library-heading, .related-heading { align-items: flex-end; display: flex; justify-content: space-between; margin-bottom: 18px; }
.library-heading h2, .related-heading h2 { font-family: Georgia, ui-serif, serif; font-size: 28px; font-weight: 500; line-height: 1.15; margin: 8px 0 0; }
.library-heading > span { color: var(--muted); font-size: 11px; }
.tutorial-grid { display: grid; gap: 14px; grid-template-columns: repeat(3, minmax(0, 1fr)); }
.tutorial-card { align-items: center; background: var(--surface); border: 1px solid var(--line); color: var(--ink); display: grid; gap: 14px; grid-template-columns: 112px minmax(0, 1fr) auto; min-height: 140px; padding: 9px; text-align: left; transition: border-color .2s ease, transform .2s ease, box-shadow .2s ease; }
.tutorial-card:hover, .tutorial-card:focus-visible { border-color: color-mix(in srgb, var(--accent-deep) 45%, var(--line)); box-shadow: var(--shadow); transform: translateY(-2px); }
.card-image { align-self: stretch; display: block; min-height: 120px; overflow: hidden; }
.card-image img { display: block; height: 100%; object-fit: cover; transition: transform .3s ease; width: 100%; }
.tutorial-card:hover .card-image img { transform: scale(1.04); }
.card-copy { display: grid; gap: 7px; min-width: 0; }
.card-meta { color: var(--muted); font-size: 9px; letter-spacing: .06em; text-transform: uppercase; }
.card-copy strong { font-family: Georgia, ui-serif, serif; font-size: 18px; font-weight: 500; line-height: 1.15; }
.card-copy small { color: var(--muted); font-size: 11px; line-height: 1.45; }
.tutorial-card > svg { color: var(--muted); margin-right: 5px; }
.tutorial-back { align-items: center; background: transparent; color: var(--muted); display: inline-flex; font-size: 12px; gap: 7px; margin-top: 38px; padding: 0; }
.tutorial-back:hover { color: var(--ink); }
.detail-header { border-bottom: 1px solid var(--line); margin-top: 25px; padding-bottom: 32px; }
.detail-kicker { align-items: center; color: var(--muted); display: flex; flex-wrap: wrap; font-size: 10px; gap: 9px 15px; letter-spacing: .08em; text-transform: uppercase; }
.detail-kicker span { align-items: center; display: inline-flex; gap: 5px; }
.detail-kicker span + span::before { color: var(--line); content: '·'; margin-right: 3px; }
.detail-header h1 { font-family: Georgia, ui-serif, serif; font-size: clamp(38px, 6vw, 72px); font-weight: 500; letter-spacing: -.045em; line-height: 1.02; margin: 19px 0 15px; max-width: 850px; }
.detail-header p { color: var(--muted); font-size: 16px; line-height: 1.65; margin: 0; max-width: 650px; }
.detail-layout { display: grid; gap: 60px; grid-template-columns: minmax(0, 1fr) 230px; padding-top: 40px; }
.detail-main { min-width: 0; }
.detail-hero { margin: 0; }
.detail-hero img { aspect-ratio: 1.7; background: var(--surface-soft); display: block; height: auto; object-fit: cover; width: 100%; }
.detail-hero figcaption { color: var(--muted); display: flex; font-size: 10px; gap: 8px; justify-content: flex-end; margin-top: 8px; }
.detail-hero figcaption span { letter-spacing: .08em; text-transform: uppercase; }
.takeaway-block { align-items: flex-start; border-bottom: 1px solid var(--line); display: flex; gap: 13px; margin-top: 35px; padding: 0 0 28px; }
.takeaway-block > svg { color: var(--accent-deep); flex: 0 0 auto; margin-top: 2px; }
.takeaway-block span, .aside-label { color: var(--muted); display: block; font-size: 10px; letter-spacing: .1em; text-transform: uppercase; }
.takeaway-block p { font-family: Georgia, ui-serif, serif; font-size: 20px; line-height: 1.45; margin: 8px 0 0; max-width: 660px; }
.detail-section, .case-study { border-top: 1px solid var(--line); margin-top: 46px; padding-top: 18px; }
.section-label { align-items: baseline; display: flex; gap: 12px; }
.section-label > span { color: var(--accent-deep); font-size: 10px; letter-spacing: .08em; }
.section-label h2 { font-family: Georgia, ui-serif, serif; font-size: 25px; font-weight: 500; line-height: 1.2; margin: 0; }
.detail-section > p:not(.detail-lead) { color: var(--muted); font-size: 14px; line-height: 1.8; margin: 14px 0 0; max-width: 680px; }
.detail-lead { font-family: Georgia, ui-serif, serif; font-size: 20px; line-height: 1.55; margin: 18px 0 0; max-width: 700px; }
.step-list { display: grid; gap: 0; list-style: none; margin: 19px 0 0; padding: 0; }
.step-list li { border-top: 1px solid var(--line); display: grid; gap: 16px; grid-template-columns: 28px minmax(0, 1fr); padding: 15px 0; }
.step-list li > span { color: var(--muted); font-size: 10px; }
.step-list p { font-size: 14px; line-height: 1.6; margin: 0; }
.case-layout { display: grid; gap: 24px; grid-template-columns: minmax(0, 1.14fr) minmax(220px, .86fr); margin-top: 20px; }
.case-layout figure { margin: 0; }
.case-layout figure img { aspect-ratio: 1.25; background: var(--surface-soft); display: block; height: auto; object-fit: cover; width: 100%; }
.case-layout figcaption { color: var(--muted); font-size: 10px; margin-top: 8px; }
.case-copy h3 { font-family: Georgia, ui-serif, serif; font-size: 21px; font-weight: 500; line-height: 1.25; margin: 0 0 12px; }
.case-copy p { color: var(--muted); font-size: 13px; line-height: 1.75; margin: 0; }
.case-copy dl, .parameter-block dl { border-top: 1px solid var(--line); margin: 20px 0 0; }
.case-copy dl div, .parameter-block dl div { align-items: baseline; border-bottom: 1px solid var(--line); display: flex; justify-content: space-between; padding: 9px 0; }
.case-copy dt, .parameter-block dt { color: var(--muted); font-size: 10px; }
.case-copy dd, .parameter-block dd { font-family: Georgia, ui-serif, serif; font-size: 12px; margin: 0; text-align: right; }
.mistake-list { display: grid; gap: 0; list-style: none; margin: 18px 0 0; padding: 0; }
.mistake-list li { border-top: 1px solid var(--line); color: var(--muted); display: flex; font-size: 13px; gap: 10px; line-height: 1.55; padding: 12px 0; }
.mistake-list li span { color: var(--accent-deep); font-size: 17px; line-height: 1; }
.detail-aside { align-self: start; position: sticky; top: 28px; }
.parameter-block { border-top: 1px solid var(--line); padding-top: 15px; }
.suggestion-block { border-top: 1px solid var(--line); margin-top: 34px; padding-top: 15px; }
.suggestion-block p { color: var(--muted); font-size: 12px; line-height: 1.7; margin: 12px 0 0; }
.aside-reset { align-items: center; background: transparent; border-bottom: 1px solid var(--line); color: var(--muted); display: inline-flex; font-size: 11px; gap: 7px; margin-top: 28px; padding: 0 0 6px; }
.aside-reset:hover { color: var(--ink); }
.related-section { border-top: 1px solid var(--line); margin-top: 80px; padding-top: 26px; }
.related-heading button { align-items: center; background: transparent; color: var(--muted); display: inline-flex; font-size: 11px; gap: 6px; padding: 0; }
.related-heading button:hover { color: var(--ink); }
.related-grid { display: grid; gap: 14px; grid-template-columns: repeat(3, minmax(0, 1fr)); }
@media (max-width: 920px) {
  .tutorial-intro { gap: 28px; grid-template-columns: minmax(0, .9fr) minmax(0, 1.1fr); }
  .tutorial-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .detail-layout { gap: 34px; grid-template-columns: minmax(0, 1fr) 190px; }
  .case-layout { grid-template-columns: minmax(0, 1fr); }
}
@media (max-width: 640px) {
  .tutorial-page { padding-bottom: 72px; }
  .tutorial-intro { display: flex; flex-direction: column-reverse; gap: 0; margin-top: 22px; padding-bottom: 30px; }
  .intro-image { min-height: 250px; }
  .intro-copy { padding: 27px 0 0; }
  .intro-copy h1 { font-size: 47px; margin-top: 14px; }
  .intro-copy p { font-size: 14px; }
  .tutorial-filters { margin-left: -16px; margin-right: -16px; padding-left: 16px; padding-right: 16px; }
  .tutorial-grid, .related-grid { grid-template-columns: 1fr; }
  .library-section { padding-top: 35px; }
  .library-heading h2, .related-heading h2 { font-size: 24px; }
  .tutorial-card { grid-template-columns: 96px minmax(0, 1fr) auto; min-height: 118px; }
  .card-image { min-height: 100px; }
  .card-copy strong { font-size: 16px; }
  .card-copy small { font-size: 10px; }
  .tutorial-back { margin-top: 24px; }
  .detail-header h1 { font-size: clamp(38px, 12vw, 58px); }
  .detail-header p { font-size: 14px; }
  .detail-layout { display: block; padding-top: 28px; }
  .detail-aside { margin-top: 34px; position: static; }
  .detail-hero img { aspect-ratio: 1.25; }
  .takeaway-block p { font-size: 18px; }
  .case-copy h3 { font-size: 20px; }
  .related-section { margin-top: 56px; }
}
</style>
