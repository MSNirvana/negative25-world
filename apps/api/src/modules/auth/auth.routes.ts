import type { FastifyInstance } from 'fastify';
import { ChangePasswordRequestSchema, ForgotPasswordRequestSchema, LoginRequestSchema, RegisterRequestSchema, ResetPasswordRequestSchema, UserProfilePatchSchema, VerifyEmailRequestSchema } from '@negative25/contracts';
import { ApiError } from '@negative25/utils';
import { AuthService, publicUser } from './auth.service.js';

export function registerAuthRoutes(app: FastifyInstance, auth: AuthService): void {
  app.post('/api/v1/auth/register', async (request) => {
    const body = RegisterRequestSchema.parse(request.body);
    const result = await auth.register({ username: body.username, email: body.email, password: body.password });
    return { session: result.session, user: publicUser(result.user), verificationRequired: true, ...(process.env.NODE_ENV === 'production' ? {} : { devVerification: { token: result.verificationToken, code: result.verificationCode } }) };
  });
  app.post('/api/v1/auth/login', async (request) => { const body = LoginRequestSchema.parse(request.body); return auth.login(body.identifier, body.password); });
  app.post('/api/v1/auth/refresh', async (request) => { const body = request.body as { refreshToken?: string }; if (!body.refreshToken) throw new ApiError('UNAUTHORIZED', 'Refresh token required'); return auth.refresh(body.refreshToken); });
  app.post('/api/v1/auth/logout', async (request) => { const body = request.body as { refreshToken?: string }; if (body.refreshToken) await auth.logout(body.refreshToken); return { ok: true }; });
  app.post('/api/v1/auth/logout-all', async (request) => { const user = await auth.authenticate(getBearer(request.headers.authorization)); await auth.logoutAll(user.id); return { ok: true }; });
  app.post('/api/v1/auth/email/verify', async (request) => { const body = VerifyEmailRequestSchema.parse(request.body); return { user: publicUser(await auth.verifyEmail(body)) }; });
  app.post('/api/v1/auth/email/resend', async (request) => { const body = ForgotPasswordRequestSchema.parse(request.body); const result = await auth.resendVerification(body.email); return { ok: true, ...(process.env.NODE_ENV === 'production' || !result ? {} : { devVerification: result }) }; });
  app.post('/api/v1/auth/password/forgot', async (request) => { const body = ForgotPasswordRequestSchema.parse(request.body); await auth.forgotPassword(body.email); return { ok: true }; });
  app.post('/api/v1/auth/password/reset', async (request) => { const body = ResetPasswordRequestSchema.parse(request.body); await auth.resetPassword(body.token, body.password); return { ok: true }; });
  app.post('/api/v1/auth/password/change', async (request) => { const user = await auth.authenticate(getBearer(request.headers.authorization)); const body = ChangePasswordRequestSchema.parse(request.body); await auth.changePassword(user, body.currentPassword, body.password); return { ok: true }; });
  app.get('/api/v1/auth/me', async (request) => { const user = await auth.authenticate(getBearer(request.headers.authorization)); return publicUser(user); });
  app.get('/api/v1/me/profile', async (request) => { const user = await auth.authenticate(getBearer(request.headers.authorization)); return auth.getProfile(user); });
  app.patch('/api/v1/me/profile', async (request) => { const user = await auth.authenticate(getBearer(request.headers.authorization)); return auth.updateProfile(user, UserProfilePatchSchema.parse(request.body)); });
  app.get('/api/v1/users/search', async (request) => { const query = request.query as { q?: string }; return { users: await auth.searchPublicUsers(String(query.q ?? '').slice(0, 80)) }; });
  app.get('/api/v1/users/:username/profile', async (request) => auth.getPublicProfile((request.params as { username: string }).username));
}

export function getBearer(value?: string): string { if (!value?.startsWith('Bearer ')) throw new ApiError('UNAUTHORIZED', 'Authentication required'); return value.slice(7); }
