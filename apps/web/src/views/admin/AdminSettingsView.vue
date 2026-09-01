<script setup lang="ts">
import { LoaderCircle, LogOut, Users } from 'lucide-vue-next';
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import type { WorkspaceMember } from '@negative25/contracts';
import { isApiConfigured, listWorkspaceMembers, logout, patchWorkspaceMember } from '../../api/client';
import { useSessionStore } from '../../stores/session';
import { useWorkspaceStore } from '../../stores/workspace';
import { useLocale } from '../../i18n';

const session = useSessionStore();
const workspace = useWorkspaceStore();
const router = useRouter();
const members = ref<WorkspaceMember[]>([]);
const loading = ref(false);
const savingId = ref<string | null>(null);
const loggingOut = ref(false);
const error = ref<string | null>(null);
const canManage = computed(() => ['owner', 'admin'].includes(workspace.active?.role ?? ''));
const { t } = useLocale();

async function loadMembers(): Promise<void> {
  if (!isApiConfigured() || !session.accessToken || !canManage.value) return;
  loading.value = true;
  error.value = null;
  try {
    members.value = await listWorkspaceMembers(workspace.slug, session.accessToken);
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : t('admin.loadMembersError');
  } finally {
    loading.value = false;
  }
}

async function changeRole(member: WorkspaceMember, event: Event): Promise<void> {
  const role = (event.target as HTMLSelectElement).value as WorkspaceMember['role'];
  const previous = member.role;
  if (role === previous || !session.accessToken || savingId.value) return;
  member.role = role;
  savingId.value = member.userId;
  error.value = null;
  try {
    const updated = await patchWorkspaceMember(workspace.slug, member.userId, role, session.accessToken);
    Object.assign(member, updated);
  } catch (cause) {
    member.role = previous;
    error.value = cause instanceof Error ? cause.message : t('admin.updateMemberError');
  } finally {
    savingId.value = null;
  }
}

function displayName(member: WorkspaceMember): string {
  return member.name?.trim() || member.email;
}

async function signOut(): Promise<void> {
  if (loggingOut.value) return;
  loggingOut.value = true;
  try {
    await logout(session.refreshToken);
  } catch {
    // Local cleanup still lets the user leave the protected area.
  } finally {
    session.clear();
    await router.replace({ name: 'auth-login' });
    loggingOut.value = false;
  }
}

onMounted(loadMembers);
watch(() => workspace.slug, loadMembers);
watch(canManage, (value) => { if (value) void loadMembers(); });
</script>

<template>
  <section class="admin-view">
    <div class="view-heading"><div><span class="eyebrow">{{ t('admin.settingsEyebrow') }}</span><h2>{{ t('admin.settingsTitle') }}</h2><p>{{ t('admin.settingsDescription', { workspace: workspace.active?.name ?? t('admin.workspace') }) }}</p></div></div>
    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    <section class="members-section">
      <div class="section-heading"><div><span class="eyebrow">{{ t('admin.access') }}</span><h3>{{ t('admin.members') }}</h3></div><span class="muted">{{ t('admin.memberCount', { count: members.length }) }}</span></div>
      <div v-if="!canManage" class="members-empty">{{ t('admin.memberRestricted') }}</div>
      <div v-else-if="loading" class="members-empty"><LoaderCircle :size="16" class="spin" /> {{ t('admin.loadingMembers') }}</div>
      <div v-else-if="!members.length" class="members-empty">{{ t('admin.noMembers') }}</div>
      <div v-else class="members-list">
        <div v-for="member in members" :key="member.userId" class="member-row">
          <span class="member-icon"><Users :size="16" /></span>
          <div class="member-copy"><strong>{{ displayName(member) }}</strong><span>{{ member.email }}</span></div>
          <select :value="member.role" :disabled="savingId === member.userId" :aria-label="t('admin.roleFor', { name: displayName(member) })" @change="changeRole(member, $event)"><option value="owner">{{ t('admin.owner') }}</option><option value="admin">{{ t('admin.admin') }}</option><option value="editor">{{ t('admin.editor') }}</option><option value="viewer">{{ t('admin.viewer') }}</option></select>
          <LoaderCircle v-if="savingId === member.userId" :size="15" class="spin muted" />
        </div>
      </div>
    </section>
    <section class="account-actions">
      <div class="section-heading"><div><span class="eyebrow">{{ t('admin.account') }}</span><h3>{{ t('admin.accountActions') }}</h3></div></div>
      <div class="logout-row">
        <div><strong>{{ t('admin.signOut') }}</strong><p>{{ t('admin.signOutDescription') }}</p></div>
        <button class="logout-action" type="button" :disabled="loggingOut" @click="signOut"><LoaderCircle v-if="loggingOut" :size="15" class="spin" /><LogOut v-else :size="15" /> {{ loggingOut ? t('admin.signingOut') : t('admin.signOut') }}</button>
      </div>
    </section>
  </section>
</template>

<style scoped>
.admin-view { max-width: 800px; }.view-heading { margin-bottom: 52px; }.view-heading h2 { font-size: 37px; letter-spacing: -.045em; margin: 10px 0 6px; }.view-heading p { color: var(--muted); margin: 0; }.form-error { color: #a34d4d; font-size: 12px; margin: -28px 0 24px; }.members-section, .account-actions { border-top: 1px solid var(--line); }.section-heading { align-items: flex-end; border-bottom: 1px solid var(--line); display: flex; justify-content: space-between; padding: 22px 0 13px; }.section-heading h3 { font-size: 14px; margin: 8px 0 0; }.section-heading .muted { font-size: 12px; }.members-empty { align-items: center; color: var(--muted); display: flex; font-size: 13px; gap: 7px; padding: 32px 0; }.members-list { display: grid; }.member-row { align-items: center; border-bottom: 1px solid var(--line); display: flex; gap: 12px; min-height: 70px; }.member-icon { align-items: center; background: var(--surface-soft); border-radius: 50%; color: var(--accent-deep); display: flex; height: 32px; justify-content: center; width: 32px; }.member-copy { display: grid; gap: 4px; min-width: 0; }.member-copy strong { font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.member-copy span { color: var(--muted); font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.member-row select { background: var(--surface); border: 1px solid var(--line); border-radius: 4px; color: var(--ink); font-size: 12px; margin-left: auto; padding: 7px 24px 7px 8px; }.member-row select:focus { border-color: var(--accent-deep); outline: 2px solid color-mix(in srgb, var(--accent) 35%, transparent); }.member-row select:disabled { cursor: wait; opacity: .6; }.logout-row { align-items: center; display: flex; gap: 18px; justify-content: space-between; padding: 20px 0; }.logout-row strong { font-size: 13px; }.logout-row p { color: var(--muted); font-size: 11px; margin: 5px 0 0; }.logout-action { align-items: center; background: transparent; border: 1px solid #b86b6b; border-radius: 4px; color: #a34d4d; display: inline-flex; flex: 0 0 auto; font-size: 12px; gap: 7px; padding: 9px 13px; }.logout-action:hover { background: color-mix(in srgb, #b86b6b 10%, transparent); }.logout-action:disabled { cursor: wait; opacity: .6; }.spin { animation: spin 1s linear infinite; }@keyframes spin { to { transform: rotate(360deg); } }
@media (max-width: 600px) { .member-row { gap: 9px; }.member-copy { max-width: calc(100% - 112px); }.member-row select { font-size: 11px; max-width: 92px; padding-right: 17px; } }
</style>
