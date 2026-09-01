CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), email TEXT NOT NULL UNIQUE,
  name TEXT, password_hash TEXT, disabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS refresh_tokens (
  token_hash TEXT PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL, locale TEXT NOT NULL DEFAULT 'en', created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, role TEXT NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE (workspace_id, user_id),
  CONSTRAINT memberships_role_check CHECK (role IN ('owner', 'admin', 'editor', 'viewer'))
);
CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES locations(id) ON DELETE SET NULL, display_name TEXT NOT NULL, localized_name TEXT,
  latitude NUMERIC(10,7), longitude NUMERIC(10,7), accuracy NUMERIC, timezone TEXT, alias TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS photos (
  id TEXT PRIMARY KEY, workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  checksum TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft', title TEXT NOT NULL DEFAULT '', description TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  captured_at TIMESTAMPTZ, captured_at_local TEXT, latitude NUMERIC(10,7), longitude NUMERIC(10,7),
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL, rating INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0, hidden BOOLEAN NOT NULL DEFAULT FALSE, published BOOLEAN NOT NULL DEFAULT FALSE,
  allow_download BOOLEAN NOT NULL DEFAULT FALSE, protected_preview BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, checksum), CONSTRAINT photos_rating_check CHECK (rating IS NULL OR rating BETWEEN 0 AND 7)
);
CREATE TABLE IF NOT EXISTS photo_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), photo_id TEXT NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  kind TEXT NOT NULL, storage_key TEXT NOT NULL UNIQUE, checksum TEXT NOT NULL, width INTEGER NOT NULL,
  height INTEGER NOT NULL, format TEXT NOT NULL, byte_size BIGINT NOT NULL, is_private BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE (photo_id, kind, width, height, format)
);
CREATE TABLE IF NOT EXISTS albums (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  slug TEXT NOT NULL, title TEXT NOT NULL, description TEXT, cover_photo_id TEXT REFERENCES photos(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE (workspace_id, slug)
);
CREATE TABLE IF NOT EXISTS equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  kind TEXT NOT NULL, name TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE (workspace_id, kind, name)
);
CREATE TABLE IF NOT EXISTS import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL, status TEXT NOT NULL DEFAULT 'uploaded', idempotency_key TEXT,
  total_count INTEGER NOT NULL DEFAULT 0, completed_count INTEGER NOT NULL DEFAULT 0, failed_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS import_batches_workspace_idempotency_unique
  ON import_batches (workspace_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE TABLE IF NOT EXISTS import_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), batch_id UUID NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
  source_key TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'uploaded', checksum TEXT, errors JSONB NOT NULL DEFAULT '[]',
  warnings JSONB NOT NULL DEFAULT '[]', resolved_fields JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (batch_id, source_key)
);
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL, action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL,
  before JSONB, after JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE photos ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
