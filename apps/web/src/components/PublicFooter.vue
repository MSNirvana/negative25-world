<template>
  <footer class="public-footer">
    <div class="footer-brand"><BrandMark compact /><p v-html="t('footer.tagline')"></p></div>
    <div class="footer-columns">
      <section>
        <span class="footer-label">negative25</span>
        <RouterLink :to="{ path: '/', query: viewerQuery }">{{ t('footer.library') }}</RouterLink>
        <RouterLink :to="{ path: '/discover', query: viewerQuery }">{{ t('footer.discover') }}</RouterLink>
        <RouterLink :to="{ path: '/albums', query: viewerQuery }">{{ t('footer.albums') }}</RouterLink>
      </section>
      <section id="app-download">
        <span class="footer-label">{{ t('footer.app') }}</span>
        <p>{{ t('footer.appDescription') }}</p>
        <a class="footer-pill" href="mailto:hello@n25.world">{{ t('header.earlyAccess') }} <span aria-hidden="true">↗</span></a>
      </section>
    </div>
    <div class="footer-bottom"><span>© {{ new Date().getFullYear() }} negative25</span><a href="mailto:hello@n25.world">{{ t('footer.contact') }}</a><a href="/account">{{ t('account.personalCenter') }}</a><span>n25.world</span></div>
  </footer>
</template>

<script setup lang="ts">
import BrandMark from './BrandMark.vue';
import { computed } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { useLocale } from '../i18n';
const { t } = useLocale();
const route = useRoute();
const viewerQuery = computed(() => route.query.user ? { user: String(route.query.user) } : {});
</script>

<style scoped>
.public-footer { border-top: 1px solid var(--line); margin: 96px auto 0; max-width: var(--max-width); padding: 44px 0 28px; }
.footer-brand { align-items: flex-start; display: flex; justify-content: space-between; }
.footer-brand p { color: var(--muted); font-size: 12px; line-height: 1.55; margin: 0; text-align: right; }
.footer-columns { display: grid; gap: 64px; grid-template-columns: 1fr 1fr; margin-top: 58px; max-width: 700px; }
.footer-columns section { display: grid; gap: 10px; align-content: start; }
.footer-label { color: var(--muted); font-size: 10px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; }
.footer-columns a, .footer-columns p { color: var(--ink); font-size: 13px; line-height: 1.5; margin: 0; }
.footer-columns a:hover { color: var(--muted); }
.footer-columns p { color: var(--muted); max-width: 270px; }
.footer-pill { align-items: center; display: inline-flex; gap: 9px; margin-top: 3px; }
.footer-pill span { color: var(--muted); font-size: 15px; }
.footer-bottom { border-top: 1px solid var(--line); color: var(--muted); display: flex; font-size: 10px; gap: 18px; justify-content: flex-end; margin-top: 56px; padding-top: 17px; }
.footer-bottom a:hover { color: var(--ink); }
@media (max-width: 640px) {
  .public-footer { margin-top: 66px; padding-top: 32px; }
  .footer-brand { display: grid; gap: 18px; }
  .footer-brand p { text-align: left; }
  .footer-columns { gap: 30px; grid-template-columns: 1fr; margin-top: 42px; }
  .footer-bottom { flex-wrap: wrap; gap: 10px 15px; justify-content: flex-start; margin-top: 42px; }
}
</style>
