import { z } from 'zod';
import { ImportStatusSchema } from './imports.js';
import { MemberRoleSchema } from './auth.js';

export const WorkspaceSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  role: MemberRoleSchema.optional(),
  kind: z.enum(['personal', 'collaborative']).optional(),
  ownerUserId: z.string().nullable().optional(),
  isPublic: z.boolean().optional(),
  allowMemberShowcase: z.boolean().optional(),
});
export type Workspace = z.infer<typeof WorkspaceSchema>;

export const AdminActivitySchema = z.object({
  type: z.literal('import'),
  id: z.string().min(1),
  status: ImportStatusSchema,
  total: z.number().int().nonnegative(),
  completed: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  createdAt: z.string().datetime({ offset: true }),
});
export type AdminActivity = z.infer<typeof AdminActivitySchema>;

export const AdminSummarySchema = z.object({
  workspace: WorkspaceSchema,
  stats: z.object({
    photoCount: z.number().int().nonnegative(),
    publishedPhotoCount: z.number().int().nonnegative(),
    pendingImportCount: z.number().int().nonnegative(),
  }),
  recentActivity: z.array(AdminActivitySchema),
});
export type AdminSummary = z.infer<typeof AdminSummarySchema>;

export const WorkspaceMemberSchema = z.object({
  userId: z.string().min(1),
  email: z.string().email(),
  name: z.string().nullable(),
  role: MemberRoleSchema,
});
export type WorkspaceMember = z.infer<typeof WorkspaceMemberSchema>;
