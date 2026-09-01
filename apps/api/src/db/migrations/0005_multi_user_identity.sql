ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

UPDATE users
SET username = CASE
  WHEN email = 'owner@n25.world' THEN 'negative25'
  ELSE 'user-' || left(md5(id::text), 19)
END
WHERE username IS NULL OR username !~ '^[A-Za-z0-9_-]{3,24}$';

ALTER TABLE users ALTER COLUMN username SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_unique ON users (lower(username));
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_username_format_check') THEN
    ALTER TABLE users ADD CONSTRAINT users_username_format_check CHECK (username ~ '^[A-Za-z0-9_-]{3,24}$');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  avatar_media_id TEXT,
  display_name TEXT,
  bio TEXT,
  location TEXT,
  website_url TEXT,
  instagram_url TEXT,
  weibo_url TEXT,
  profile_public BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE user_profiles ALTER COLUMN profile_public SET DEFAULT TRUE;
UPDATE user_profiles SET profile_public = TRUE;

CREATE TABLE IF NOT EXISTS username_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  normalized_username TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose IN ('verify_email', 'reset_password', 'change_email')),
  token_hash TEXT NOT NULL UNIQUE,
  code_hash TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_challenges_user_purpose_idx ON email_challenges (user_id, purpose, created_at DESC);

ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;

ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'collaborative';
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS allow_member_showcase BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE workspaces DROP CONSTRAINT IF EXISTS workspaces_kind_check;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workspaces_kind_check') THEN
    ALTER TABLE workspaces ADD CONSTRAINT workspaces_kind_check CHECK (kind IN ('personal', 'collaborative'));
  END IF;
END $$;

UPDATE workspaces w SET kind = 'personal', owner_user_id = u.id, allow_member_showcase = TRUE
FROM users u, memberships m
WHERE m.user_id = u.id AND m.workspace_id = w.id AND m.role = 'owner'
  AND w.slug = 'primary' AND w.owner_user_id IS NULL;

CREATE TABLE IF NOT EXISTS workspace_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  inviter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invitee_email TEXT,
  invitee_username TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin', 'editor', 'viewer')),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (invitee_email IS NOT NULL OR invitee_username IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS workspace_invitations_workspace_idx ON workspace_invitations (workspace_id, created_at DESC);

CREATE TABLE IF NOT EXISTS profile_publications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  album_id UUID,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, workspace_id, album_id)
);

CREATE TABLE IF NOT EXISTS platform_roles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('platform_admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS platform_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  before JSONB,
  after JSONB,
  request_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
