import { z } from 'zod';

const requiredUrl = z.string().url();
const serverSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: requiredUrl,
  N25_USE_DATABASE: z.enum(['0', '1']).default('0'),
  N25_IMPORT_QUEUE: z.enum(['0', '1']).default('1'),
  REDIS_URL: requiredUrl,
  S3_ENDPOINT: requiredUrl,
  S3_PUBLIC_ENDPOINT: requiredUrl.optional(),
  S3_BUCKET: z.string().min(1),
  S3_REGION: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  JWT_SECRET: z.string().min(1),
  JWT_REFRESH_SECRET: z.string().min(1),
  WEB_ORIGIN: requiredUrl,
  PRIMARY_WORKSPACE_SLUG: z.string().min(1),
  MAP_STYLE_URL: requiredUrl,
  GEOCODER_URL: requiredUrl,
});
export type ServerEnv = z.infer<typeof serverSchema>;
export function parseServerEnv(input: Record<string, unknown> = process.env): ServerEnv {
  return serverSchema.parse(input);
}

const webSchema = z.object({ VITE_API_BASE_URL: requiredUrl });
export type WebEnv = { apiBaseUrl: string };
export function parseWebEnv(input: Record<string, unknown> = (import.meta as ImportMeta & { env: Record<string, unknown> }).env): WebEnv {
  return { apiBaseUrl: webSchema.parse(input).VITE_API_BASE_URL };
}
