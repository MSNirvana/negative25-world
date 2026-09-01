import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { fetchPublicProfile, type PublicProfile } from '../api/client';

export const usePublicViewerStore = defineStore('public-viewer', () => {
  const username = ref<string | null>(null);
  const profile = ref<PublicProfile | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const active = computed(() => Boolean(username.value && profile.value));
  let requestId = 0;

  async function load(nextUsername: string | null): Promise<PublicProfile | null> {
    const normalized = nextUsername?.replace(/^@/, '').trim().toLowerCase() || null;
    if (!normalized) { clear(); return null; }
    if (username.value === normalized && profile.value) return profile.value;
    const id = ++requestId;
    username.value = normalized;
    profile.value = null;
    loading.value = true;
    error.value = null;
    try {
      const next = await fetchPublicProfile(normalized);
      if (id !== requestId) return null;
      profile.value = next;
      return next;
    } catch (cause) {
      if (id === requestId) error.value = cause instanceof Error ? cause.message : 'Unable to load public archive';
      return null;
    } finally {
      if (id === requestId) loading.value = false;
    }
  }
  function clear(): void { requestId += 1; username.value = null; profile.value = null; loading.value = false; error.value = null; }
  return { username, profile, loading, error, active, load, clear };
});
