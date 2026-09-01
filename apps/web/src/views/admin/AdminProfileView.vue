<script setup lang="ts">
import { Check, LoaderCircle, Save, UserRound } from 'lucide-vue-next';
import { onMounted, ref } from 'vue';
import type { UserProfile } from '@negative25/contracts';
import { fetchUserProfile, patchUserProfile } from '../../api/client';
import { useLocale } from '../../i18n';
import { useSessionStore } from '../../stores/session';

const session = useSessionStore();
const { t } = useLocale();
const profile = ref<UserProfile | null>(null);
const loading = ref(true);
const saving = ref(false);
const error = ref<string | null>(null);
const saved = ref(false);

async function load(): Promise<void> {
  if (!session.accessToken) return;
  loading.value = true;
  error.value = null;
  try {
    profile.value = await fetchUserProfile(session.accessToken);
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : t('account.profileSaveError');
  } finally {
    loading.value = false;
  }
}

async function save(): Promise<void> {
  if (!session.accessToken || !profile.value || saving.value) return;
  saving.value = true;
  saved.value = false;
  error.value = null;
  try {
    profile.value = await patchUserProfile(session.accessToken, {
      displayName: profile.value.displayName?.trim() || null,
      bio: profile.value.bio?.trim() || null,
      location: profile.value.location?.trim() || null,
      websiteUrl: profile.value.websiteUrl?.trim() || null,
      instagramUrl: profile.value.instagramUrl?.trim() || null,
      weiboUrl: profile.value.weiboUrl?.trim() || null,
      profilePublic: profile.value.profilePublic,
    });
    saved.value = true;
    window.setTimeout(() => { saved.value = false; }, 2200);
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : t('account.profileSaveError');
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  await session.loadUser();
  await load();
});
</script>

<template>
  <section class="admin-view profile-view">
    <div class="view-heading"><div><span class="eyebrow">{{ t('account.profileEyebrow') }}</span><h2>{{ t('account.profileTitle') }}</h2><p>{{ t('account.profileDescription') }}</p></div></div>
    <div v-if="loading" class="profile-state"><LoaderCircle :size="16" class="spin" /> {{ t('account.loadingProfile') }}</div>
    <template v-else-if="profile">
      <form class="profile-form" @submit.prevent="save">
        <div class="profile-identity">
          <div class="avatar"><UserRound :size="24" /></div>
          <div><strong>@{{ profile.username }}</strong><span>{{ profile.email }}</span></div>
        </div>
        <label>{{ t('account.displayName') }}<input v-model="profile.displayName" maxlength="80" autocomplete="name" /></label>
        <label>{{ t('account.bio') }}<textarea v-model="profile.bio" maxlength="1000" rows="4" /></label>
        <label>{{ t('account.location') }}<input v-model="profile.location" maxlength="120" autocomplete="address-level2" /></label>
        <div class="form-grid">
          <label>{{ t('account.website') }}<input v-model="profile.websiteUrl" type="url" placeholder="https://" /></label>
          <label>{{ t('account.instagram') }}<input v-model="profile.instagramUrl" type="url" placeholder="https://instagram.com/" /></label>
          <label>{{ t('account.weibo') }}<input v-model="profile.weiboUrl" type="url" placeholder="https://weibo.com/" /></label>
        </div>
        <div class="email-status"><span>{{ t('account.emailStatus') }}</span><strong :class="{ verified: profile.emailVerifiedAt }"><Check v-if="profile.emailVerifiedAt" :size="14" /> {{ profile.emailVerifiedAt ? t('account.emailVerified') : t('account.emailUnverified') }}</strong></div>
        <label class="toggle-row"><input v-model="profile.profilePublic" type="checkbox" /><span><strong>{{ t('account.profilePublic') }}</strong><small>{{ t('account.profilePublicHint') }}</small></span></label>
        <p v-if="error" class="form-error" role="alert">{{ error }}</p>
        <div class="form-actions"><button type="submit" :disabled="saving"><LoaderCircle v-if="saving" :size="15" class="spin" /><Save v-else :size="15" /> {{ saving ? t('admin.saving') : t('account.saveProfile') }}</button><span v-if="saved" class="saved"><Check :size="14" /> {{ t('account.profileSaved') }}</span></div>
      </form>
    </template>
    <p v-else class="profile-state form-error" role="alert">{{ error }}</p>
  </section>
</template>

<style scoped>
.admin-view { max-width: 800px; }.view-heading { margin-bottom: 42px; }.view-heading h2 { font-size: 37px; letter-spacing: -.045em; margin: 10px 0 6px; }.view-heading p { color: var(--muted); margin: 0; }.profile-state { align-items: center; color: var(--muted); display: flex; font-size: 13px; gap: 8px; padding: 30px 0; }.profile-form { border-top: 1px solid var(--line); display: grid; gap: 18px; padding-top: 22px; }.profile-identity { align-items: center; border-bottom: 1px solid var(--line); display: flex; gap: 13px; padding-bottom: 22px; }.avatar { align-items: center; background: var(--surface-soft); border-radius: 50%; color: var(--accent-deep); display: flex; height: 52px; justify-content: center; width: 52px; }.profile-identity div:last-child { display: grid; gap: 4px; }.profile-identity strong { font-size: 14px; }.profile-identity span { color: var(--muted); font-size: 12px; }label { color: var(--muted); display: grid; font-size: 12px; gap: 7px; }input, textarea { background: var(--surface); border: 1px solid var(--line); border-radius: 3px; color: var(--ink); font: inherit; padding: 10px 11px; width: 100%; }textarea { min-height: 90px; resize: vertical; }input:focus, textarea:focus { border-color: var(--accent-deep); outline: 2px solid color-mix(in srgb, var(--accent) 35%, transparent); }.form-grid { display: grid; gap: 14px; grid-template-columns: repeat(3, 1fr); }.email-status { align-items: center; border-top: 1px solid var(--line); display: flex; justify-content: space-between; margin-top: 4px; padding-top: 18px; }.email-status span { color: var(--muted); font-size: 12px; }.email-status strong { align-items: center; color: var(--muted); display: inline-flex; font-size: 12px; gap: 4px; }.email-status strong.verified { color: #4f7e62; }.toggle-row { align-items: flex-start; border-top: 1px solid var(--line); display: flex; gap: 10px; padding-top: 18px; }.toggle-row input { accent-color: var(--accent-deep); margin-top: 3px; width: auto; }.toggle-row span { display: grid; gap: 4px; }.toggle-row strong { color: var(--ink); font-size: 13px; }.toggle-row small { color: var(--muted); font-size: 11px; line-height: 1.5; }.form-error { color: #a34d4d; font-size: 12px; margin: 0; }.form-actions { align-items: center; display: flex; gap: 14px; padding-top: 4px; }.form-actions button { align-items: center; background: var(--ink); border-radius: 3px; color: var(--paper); display: inline-flex; font-size: 12px; gap: 7px; padding: 10px 14px; }.form-actions button:disabled { cursor: wait; opacity: .6; }.saved { align-items: center; color: #4f7e62; display: inline-flex; font-size: 12px; gap: 5px; }.spin { animation: spin 1s linear infinite; }@keyframes spin { to { transform: rotate(360deg); } }
@media (max-width: 680px) { .form-grid { grid-template-columns: 1fr; } }
</style>
