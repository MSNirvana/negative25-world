import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { fetchWorkspaces, isApiConfigured } from '../api/client';
import type { Workspace } from '@negative25/contracts';
import { t } from '../i18n';

const storageKey = 'negative25.workspace';

export const useWorkspaceStore = defineStore('workspace', () => {
  const slug = ref('primary');
  const spaces = ref<Workspace[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const active = computed(() => spaces.value.find((space) => space.slug === slug.value) ?? null);

  function hydrate(): void {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(storageKey);
    if (stored) slug.value = stored;
  }

  async function load(token: string | null): Promise<void> {
    if (!token || !isApiConfigured() || loading.value) return;
    loading.value = true;
    error.value = null;
    try {
      spaces.value = await fetchWorkspaces(token);
      if (!spaces.value.some((space) => space.slug === slug.value)) slug.value = spaces.value[0]?.slug ?? 'primary';
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : t('admin.loadWorkspacesError');
    } finally {
      loading.value = false;
    }
  }

  function select(nextSlug: string): void {
    if (spaces.value.length && !spaces.value.some((space) => space.slug === nextSlug)) return;
    slug.value = nextSlug;
    if (typeof window !== 'undefined') window.localStorage.setItem(storageKey, nextSlug);
  }

  hydrate();
  return { slug, spaces, active, loading, error, load, select, hydrate };
});
