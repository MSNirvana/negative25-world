import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { configureAuthSession, fetchCurrentUser, isApiConfigured, login as requestLogin } from '../api/client';
import { t } from '../i18n';

const storageKey = 'negative25.session';
type StoredSession = { accessToken: string; refreshToken: string; expiresIn: number };

export const useSessionStore = defineStore('session', () => {
  const accessToken = ref<string | null>(null);
  const refreshToken = ref<string | null>(null);
  const error = ref<string | null>(null);
  const user = ref<{ id: string; username?: string; email: string; name: string | null; emailVerifiedAt?: string | null } | null>(null);
  const ready = ref(false);
  const authenticated = computed(() => Boolean(accessToken.value));

  function hydrate(): void {
    if (ready.value || typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      const stored = JSON.parse(raw ?? 'null') as StoredSession | null;
      accessToken.value = stored?.accessToken ?? null;
      refreshToken.value = stored?.refreshToken ?? null;
    } catch {
      clear();
    } finally {
      ready.value = true;
    }
  }

  async function login(identifier: string, password: string): Promise<boolean> {
    error.value = null;
    try {
      const nextSession = await requestLogin(identifier, password);
      accessToken.value = nextSession.accessToken;
      refreshToken.value = nextSession.refreshToken;
      window.localStorage.setItem(storageKey, JSON.stringify(nextSession));
      user.value = await fetchCurrentUser(nextSession.accessToken);
      return true;
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : t('admin.signInError');
      return false;
    }
  }

  async function loadUser(): Promise<void> {
    if (!accessToken.value || user.value) return;
    try {
      user.value = await fetchCurrentUser(accessToken.value);
    } catch {
      clear();
    }
  }

  function clear(): void {
    accessToken.value = null;
    refreshToken.value = null;
    user.value = null;
    if (typeof window !== 'undefined') window.localStorage.removeItem(storageKey);
  }

  configureAuthSession({
    get: () => ({ accessToken: accessToken.value, refreshToken: refreshToken.value }),
    set: (session) => {
      accessToken.value = session.accessToken;
      refreshToken.value = session.refreshToken;
      if (typeof window !== 'undefined') window.localStorage.setItem(storageKey, JSON.stringify(session));
    },
    clear,
    sessionExpiredMessage: () => t('admin.sessionExpired'),
  });

  hydrate();
  return { accessToken, refreshToken, user, error, ready, authenticated, login, loadUser, clear, hydrate, apiConfigured: isApiConfigured() };
});
