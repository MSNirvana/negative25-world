import { z } from 'zod';
import { PhotoSummarySchema } from './photos.js';

export const MemberRoleSchema = z.enum(['owner', 'admin', 'editor', 'viewer']);
export type MemberRole = z.infer<typeof MemberRoleSchema>;

export const UsernameSchema = z.string().trim().min(3).max(24).regex(/^[A-Za-z0-9_-]+$/);
export const EmailSchema = z.string().trim().email().max(320).transform((value) => value.toLowerCase());
export const PasswordSchema = z.string().min(8).max(128).regex(/[A-Za-z]/).regex(/[0-9]/);
export const LoginRequestSchema = z.object({ identifier: z.string().trim().min(1).max(320).optional(), email: z.string().trim().email().max(320).optional(), password: z.string().min(1) }).refine((value) => Boolean(value.identifier || value.email), { message: 'Username or email is required', path: ['identifier'] }).transform((value) => ({ identifier: value.identifier ?? value.email as string, password: value.password }));
export const RegisterRequestSchema = z.object({ username: UsernameSchema, email: EmailSchema, password: PasswordSchema, passwordConfirmation: z.string().min(1) }).superRefine((value, context) => {
  if (value.password !== value.passwordConfirmation) context.addIssue({ code: z.ZodIssueCode.custom, path: ['passwordConfirmation'], message: 'Passwords do not match' });
});
export const VerifyEmailRequestSchema = z.object({ email: EmailSchema.optional(), token: z.string().min(1).optional(), code: z.string().regex(/^\d{6}$/).optional() }).refine((value) => Boolean(value.token || (value.email && value.code)), { message: 'Verification token or email and code are required' });
export const ForgotPasswordRequestSchema = z.object({ email: EmailSchema });
export const ResetPasswordRequestSchema = z.object({ token: z.string().min(1), password: PasswordSchema });
export const ChangePasswordRequestSchema = z.object({ currentPassword: z.string().min(1), password: PasswordSchema });
export const UserProfilePatchSchema = z.object({ displayName: z.string().trim().max(80).nullable().optional(), bio: z.string().trim().max(1000).nullable().optional(), location: z.string().trim().max(120).nullable().optional(), websiteUrl: z.string().url().nullable().optional(), instagramUrl: z.string().url().nullable().optional(), weiboUrl: z.string().url().nullable().optional(), avatarMediaId: z.string().trim().max(240).nullable().optional(), profilePublic: z.boolean().optional() });
export const SessionSchema = z.object({ accessToken: z.string(), refreshToken: z.string(), expiresIn: z.number().int().positive() });
export const UserSchema = z.object({ id: z.string(), username: UsernameSchema.optional(), email: z.string().email(), name: z.string().nullable(), emailVerifiedAt: z.string().nullable().optional() });
export const UserProfileSchema = z.object({ userId: z.string(), username: UsernameSchema, email: z.string().email(), emailVerifiedAt: z.string().nullable(), displayName: z.string().nullable(), bio: z.string().nullable(), location: z.string().nullable(), websiteUrl: z.string().url().nullable(), instagramUrl: z.string().url().nullable(), weiboUrl: z.string().url().nullable(), avatarMediaId: z.string().nullable(), profilePublic: z.boolean() });
export type UserProfile = z.infer<typeof UserProfileSchema>;
export const PublicProfileSearchResultSchema = z.object({ username: UsernameSchema, displayName: z.string().nullable(), bio: z.string().nullable(), location: z.string().nullable(), avatarMediaId: z.string().nullable() });
export const PublicProfileSearchResponseSchema = z.object({ users: z.array(PublicProfileSearchResultSchema) });
export type PublicProfileSearchResult = z.infer<typeof PublicProfileSearchResultSchema>;
export const PublicProfileSchema = PublicProfileSearchResultSchema.extend({ websiteUrl: z.string().url().nullable(), instagramUrl: z.string().url().nullable(), weiboUrl: z.string().url().nullable(), profilePublic: z.boolean().default(true), workspaceSlug: z.string().nullable(), photos: z.array(PhotoSummarySchema) });
export type PublicProfile = z.infer<typeof PublicProfileSchema>;
