<script setup lang="ts">
import { ArrowRight, LockKeyhole } from 'lucide-vue-next';
import { ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import LanguageSwitcher from '../components/LanguageSwitcher.vue';
import { registerAccount } from '../api/client';
import { useLocale } from '../i18n';
import { useSessionStore } from '../stores/session';

const router = useRouter();
const session = useSessionStore();
const username = ref('');
const email = ref('');
const password = ref('');
const passwordConfirmation = ref('');
const busy = ref(false);
const error = ref<string | null>(null);
const message = ref<string | null>(null);
const { t } = useLocale();

async function submit(): Promise<void> {
  error.value = null;
  message.value = null;
  if (password.value !== passwordConfirmation.value) { error.value = t('account.passwordMismatch'); return; }
  if (password.value.length < 8 || !/[A-Za-z]/.test(password.value) || !/[0-9]/.test(password.value)) { error.value = t('account.passwordRule'); return; }
  busy.value = true;
  try {
    const result = await registerAccount({ username: username.value, email: email.value, password: password.value, passwordConfirmation: passwordConfirmation.value });
    session.clear();
    message.value = t('account.registrationSuccess');
    if (result.devVerification) window.localStorage.setItem('negative25.devVerification', JSON.stringify({ email: email.value, ...result.devVerification }));
    window.setTimeout(() => void router.replace('/auth/login'), 900);
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : t('account.registrationError');
  } finally { busy.value = false; }
}
</script>

<template>
  <main class="register-page page-frame">
    <LanguageSwitcher />
    <section class="register-panel">
      <span class="login-icon"><LockKeyhole :size="18" /></span>
      <span class="eyebrow">negative25 · {{ t('account.personalCenter') }}</span>
      <h1>{{ t('account.createAccount') }}</h1>
      <p>{{ t('account.registerDescription') }}</p>
      <form @submit.prevent="submit">
        <label>{{ t('account.username') }}<input v-model="username" autocomplete="username" required minlength="3" maxlength="24" /></label>
        <label>{{ t('admin.email') }}<input v-model="email" type="email" autocomplete="email" required /></label>
        <label>{{ t('admin.password') }}<input v-model="password" type="password" autocomplete="new-password" required minlength="8" /></label>
        <label>{{ t('account.confirmPassword') }}<input v-model="passwordConfirmation" type="password" autocomplete="new-password" required minlength="8" /></label>
        <p v-if="error" class="form-error" role="alert">{{ error }}</p>
        <p v-if="message" class="form-success" role="status">{{ message }}</p>
        <button type="submit" :disabled="busy"><span>{{ busy ? t('account.creating') : t('account.register') }}</span><ArrowRight :size="16" /></button>
        <RouterLink class="register-link" to="/auth/login">{{ t('account.haveAccount') }}</RouterLink>
      </form>
    </section>
  </main>
</template>

<style scoped>
.register-page { align-items: center; display: flex; justify-content: center; min-height: calc(100vh - 72px); min-height: calc(100dvh - 72px); padding-bottom: env(safe-area-inset-bottom); }.register-page > .language-switcher { position: absolute; right: 28px; top: max(28px, env(safe-area-inset-top)); }.register-panel { max-width: 390px; padding: 48px 0 80px; width: 100%; }.login-icon { align-items: center; background: var(--surface-soft); border-radius: 50%; color: var(--accent-deep); display: flex; height: 40px; justify-content: center; margin-bottom: 24px; width: 40px; }h1 { font-size: 43px; letter-spacing: -.045em; margin: 10px 0 7px; }.register-panel > p { color: var(--muted); line-height: 1.5; margin: 0 0 32px; overflow-wrap: anywhere; }form { display: grid; gap: 17px; }label { color: var(--muted); display: grid; font-size: 12px; gap: 7px; }input { background: var(--surface); border: 1px solid var(--line); border-radius: 4px; color: var(--ink); font: inherit; min-height: 42px; padding: 11px 12px; width: 100%; }input:focus { border-color: var(--accent-deep); outline: 2px solid color-mix(in srgb, var(--accent) 35%, transparent); }button { align-items: center; background: var(--ink); border-radius: 4px; color: var(--paper); display: inline-flex; font-size: 13px; gap: 9px; justify-content: center; margin-top: 6px; min-height: 42px; padding: 12px 16px; }button:disabled { cursor: wait; opacity: .55; }.register-link { align-items: center; color: var(--muted); display: inline-flex; font-size: 12px; gap: 7px; justify-content: center; min-height: 40px; padding: 8px; }.register-link:hover { color: var(--ink); }.form-error { color: #a34d4d; font-size: 12px; line-height: 1.45; margin: 0; overflow-wrap: anywhere; }.form-success { color: #4f7e62; font-size: 12px; line-height: 1.45; margin: 0; }
@media (max-width: 580px) { .register-page { align-items: flex-start; padding-top: 34px; }.register-page > .language-switcher { right: 16px; top: max(16px, env(safe-area-inset-top)); }.register-panel { padding: 34px 0 calc(56px + env(safe-area-inset-bottom)); }.login-icon { margin-bottom: 19px; }.register-panel > p { margin-bottom: 24px; }h1 { font-size: 36px; }form { gap: 14px; } }
</style>
