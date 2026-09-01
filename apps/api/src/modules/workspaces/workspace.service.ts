import { ApiError } from '@negative25/utils';
import type { AppRepository, MembershipRecord, WorkspaceRecord } from '../../db/repository.js';
export type Workspace = WorkspaceRecord; export type Membership = MembershipRecord;
export class WorkspaceService {
  constructor(private readonly repository: AppRepository) {}
  get memberships() { return { push: (membership: MembershipRecord) => { void this.repository.saveMembership(membership); } }; }
  async getMembership(workspaceId: string, userId: string) { return this.repository.findMembership(workspaceId, userId); }
  async listForUser(userId: string) { return this.repository.listWorkspacesForUser(userId); }
  async listPhotos(workspaceId: string) { return this.repository.listPhotos(workspaceId); }
  async findPhoto(workspaceId: string, id: string) { return this.repository.findPhoto(workspaceId, id); }
  async getBySlug(slug: string) { const workspace = await this.repository.findWorkspaceBySlug(slug); if (!workspace) throw new ApiError('NOT_FOUND', 'Space not found'); return workspace; }
  async getPublicBySlug(slug: string) {
    const workspace = await this.getBySlug(slug);
    if (workspace.kind !== 'personal' || !workspace.ownerUserId) throw new ApiError('NOT_FOUND', 'Space not found');
    const profile = await this.repository.findUserProfile(workspace.ownerUserId);
    if (!profile?.profilePublic) throw new ApiError('NOT_FOUND', 'Space not found');
    return workspace;
  }
  async requireWorkspaceRole(slug: string, userId: string, roles: Membership['role'][] = ['owner', 'admin', 'editor', 'viewer']) { const workspace = await this.getBySlug(slug); const membership = await this.repository.findMembership(workspace.id, userId); if (!membership || !roles.includes(membership.role)) throw new ApiError('FORBIDDEN', 'Workspace access denied'); return workspace; }
}
