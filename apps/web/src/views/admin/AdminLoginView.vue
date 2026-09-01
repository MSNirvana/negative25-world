<script setup lang="ts">
import { ref } from 'vue';
import { ArrowRight, LockKeyhole, UserPlus } from 'lucide-vue-next';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { useSessionStore } from '../../stores/session';
import LanguageSwitcher from '../../components/LanguageSwitcher.vue';
import { useLocale } from '../../i18n';

const router = useRouter();
const route = useRoute();
const session = useSessionStore();
const identifier = ref('negative25');
const password = ref('negative25');
const busy = ref(false);
const { t } = useLocale();

async function submit(): Promise<void> {
  busy.value = true;
  const success = await session.login(identifier.value, password.value);
  busy.value = false;
  if (success) void router.replace(typeof route.query.redirect === 'string' ? route.query.redirect : '/account');
}
</script>

<template>
  <main class="login-page page-frame">
    <LanguageSwitcher />
    <section class="login-panel">
      <span class="login-icon"><LockKeyhole :size="18" /></span>
      <span class="eyebrow">negative25 · {{ t('account.personalCenter') }}</span>
      <h1>{{ t('admin.signIn') }}</h1>
      <p>{{ t('admin.signInDescription') }}</p>
      <form @submit.prevent="submit">
        <label>{{ t('account.identifier') }}<input v-model="identifier" autocomplete="username" required /></label>
        <label>{{ t('admin.password') }}<input v-model="password" type="password" autocomplete="current-password" required /></label>
        <p v-if="session.error" class="form-error" role="alert">{{ session.error }}</p>
        <button type="submit" :disabled="busy"><span>{{ busy ? t('admin.signingIn') : t('admin.continue') }}</span><ArrowRight :size="16" /></button>
        <RouterLink class="register-link" to="/auth/register"><UserPlus :size="15" /> {{ t('account.createAccount') }}</RouterLink>
      </form>
    </section>
  </main>
</template>

<style scoped>
.login-page > .language-switcher { position: absolute; right: 28px; top: 28px; }
.login-page { align-items: center; display: flex; justify-content: center; min-height: calc(100vh - 72px); }
.login-panel { max-width: 390px; padding: 48px 0 80px; width: 100%; }
.login-icon { align-items: center; background: var(--surface-soft); border-radius: 50%; color: var(--accent-deep); display: flex; height: 40px; justify-content: center; margin-bottom: 24px; width: 40px; }
h1 { font-size: 43px; letter-spacing: -.045em; margin: 10px 0 7px; }
.login-panel > p { color: var(--muted); margin: 0 0 32px; }
form { display: grid; gap: 17px; }
label { color: var(--muted); display: grid; font-size: 12px; gap: 7px; }
input { background: var(--surface); border: 1px solid var(--line); border-radius: 4px; color: var(--ink); font: inherit; padding: 11px 12px; }
input:focus { border-color: var(--accent-deep); outline: 2px solid color-mix(in srgb, var(--accent) 35%, transparent); }
button { align-items: center; background: var(--ink); border-radius: 4px; color: var(--paper); display: inline-flex; font-size: 13px; gap: 9px; justify-content: center; margin-top: 6px; padding: 12px 16px; }
button:disabled { cursor: wait; opacity: .55; }
.register-link { align-items: center; color: var(--muted); display: inline-flex; font-size: 12px; gap: 7px; justify-content: center; margin-top: 5px; padding: 8px; }.register-link:hover { color: var(--ink); }
.form-error { color: #a34d4d; font-size: 12px; margin: 0; }
</style>
