    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
      password TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('member','admin')),
      created_at TEXT NOT NULL DEFAULT to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires BIGINT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS categories (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE);
    CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id),
      visibility TEXT NOT NULL CHECK(visibility IN ('public','private')),
      category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
      title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', filename TEXT NOT NULL,
      size INTEGER NOT NULL, sha256 TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')
    );
    CREATE TABLE IF NOT EXISTS history (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
      last_played TEXT NOT NULL DEFAULT to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'), plays INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY(user_id,game_id)
    );
    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
      game_id TEXT REFERENCES games(id) ON DELETE CASCADE,
      title TEXT NOT NULL, body TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')
    );
    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY, post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id), body TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')
    );
    CREATE INDEX IF NOT EXISTS games_visibility ON games(visibility,category_id);
    CREATE INDEX IF NOT EXISTS games_owner ON games(owner_id);
    CREATE INDEX IF NOT EXISTS posts_game ON posts(game_id,created_at);
    CREATE INDEX IF NOT EXISTS comments_post ON comments(post_id,created_at);
    CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires);
  
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON users FROM PUBLIC;

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sessions FROM PUBLIC;

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON categories FROM PUBLIC;

ALTER TABLE games ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON games FROM PUBLIC;

ALTER TABLE history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON history FROM PUBLIC;

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON posts FROM PUBLIC;

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON comments FROM PUBLIC;

-- Imported public games are served directly from the verified Storage archive.
ALTER TABLE games ADD COLUMN IF NOT EXISTS storage_object TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS games_storage_object ON games(storage_object) WHERE storage_object IS NOT NULL;

ALTER TABLE games ADD COLUMN IF NOT EXISTS icon_data TEXT;

-- A family groups imported editions without changing file IDs or saves.
ALTER TABLE games ADD COLUMN IF NOT EXISTS family_key TEXT;
ALTER TABLE games ADD COLUMN IF NOT EXISTS family_title TEXT;
CREATE INDEX IF NOT EXISTS games_family ON games(family_key) WHERE family_key IS NOT NULL;

ALTER TABLE posts ADD COLUMN IF NOT EXISTS media JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE games ADD COLUMN IF NOT EXISTS screen TEXT;

ALTER TABLE games ADD COLUMN IF NOT EXISTS publisher TEXT NOT NULL DEFAULT '';
ALTER TABLE games ADD COLUMN IF NOT EXISTS hidden BOOLEAN NOT NULL DEFAULT false;
CREATE OR REPLACE FUNCTION search_fold(value TEXT) RETURNS TEXT LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
 SELECT regexp_replace(normalize(replace(lower(coalesce(value,'')),'đ','d'),NFD),'[̀-ͯ]','','g')
$$;
CREATE TABLE IF NOT EXISTS favorites (
 user_id TEXT REFERENCES users(id) ON DELETE CASCADE, family_key TEXT NOT NULL,
 game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE, PRIMARY KEY(user_id,family_key)
);
CREATE TABLE IF NOT EXISTS reviews (
 user_id TEXT REFERENCES users(id) ON DELETE CASCADE, family_key TEXT NOT NULL,
 game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
 rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),body TEXT NOT NULL DEFAULT '',
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),PRIMARY KEY(user_id,family_key)
);
CREATE TABLE IF NOT EXISTS game_reports (
 id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,body TEXT NOT NULL,
 resolved BOOLEAN NOT NULL DEFAULT false,created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS notifications (
 id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 actor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
 comment_id TEXT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
 is_read BOOLEAN NOT NULL DEFAULT false,created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user ON notifications(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS reviews_family ON reviews(family_key);
CREATE TABLE IF NOT EXISTS cloud_saves (
 user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 data BYTEA NOT NULL,revision TEXT NOT NULL,updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE cloud_saves ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON favorites,reviews,game_reports,notifications,cloud_saves FROM PUBLIC;

ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT NOT NULL DEFAULT '';
ALTER TABLE games ADD COLUMN IF NOT EXISTS touch_supported BOOLEAN;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_public BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar JSONB;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS reply_to TEXT REFERENCES comments(id) ON DELETE SET NULL;
CREATE TABLE IF NOT EXISTS collections (
 id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 title TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',public BOOLEAN NOT NULL DEFAULT false,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS collection_games (
 collection_id TEXT REFERENCES collections(id) ON DELETE CASCADE,
 game_id TEXT REFERENCES games(id) ON DELETE CASCADE,PRIMARY KEY(collection_id,game_id)
);
CREATE TABLE IF NOT EXISTS game_checks (
 user_id TEXT REFERENCES users(id) ON DELETE CASCADE,game_id TEXT REFERENCES games(id) ON DELETE CASCADE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),PRIMARY KEY(user_id,game_id)
);
CREATE TABLE IF NOT EXISTS admin_audit (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,actor_id TEXT,
 action TEXT NOT NULL,game_id TEXT NOT NULL,before_data JSONB,after_data JSONB,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION audit_game_changes() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (TG_OP='INSERT' AND NEW.visibility='public') OR (TG_OP='DELETE' AND OLD.visibility='public') OR
    (TG_OP='UPDATE' AND (OLD.visibility='public' OR NEW.visibility='public')) THEN
  INSERT INTO admin_audit(actor_id,action,game_id,before_data,after_data)
  VALUES(nullif(current_setting('app.actor_id',true),''),TG_OP,coalesce(NEW.id,OLD.id),
    CASE WHEN TG_OP='INSERT' THEN NULL ELSE to_jsonb(OLD)-'icon_data'-'inspection'-'boot_report' END,
    CASE WHEN TG_OP='DELETE' THEN NULL ELSE to_jsonb(NEW)-'icon_data'-'inspection'-'boot_report' END);
 END IF;
 RETURN coalesce(NEW,OLD);
END $$;
DROP TRIGGER IF EXISTS games_audit ON games;
CREATE TRIGGER games_audit AFTER INSERT OR UPDATE OR DELETE ON games FOR EACH ROW EXECUTE FUNCTION audit_game_changes();
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON collections,collection_games,game_checks,admin_audit FROM PUBLIC;

ALTER TABLE games ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS tag TEXT NOT NULL DEFAULT 'share';
ALTER TABLE posts ADD COLUMN IF NOT EXISTS accepted_comment_id TEXT REFERENCES comments(id) ON DELETE SET NULL;
CREATE TABLE IF NOT EXISTS game_guides (
 game_id TEXT PRIMARY KEY REFERENCES games(id) ON DELETE CASCADE,
 body TEXT NOT NULL,updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS content_reports (
 id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
 comment_id TEXT REFERENCES comments(id) ON DELETE CASCADE,
 reason TEXT NOT NULL,resolved BOOLEAN NOT NULL DEFAULT false,created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS cloud_save_versions (
 user_id TEXT REFERENCES users(id) ON DELETE CASCADE,revision TEXT NOT NULL,
 data BYTEA NOT NULL,updated_at TIMESTAMPTZ NOT NULL,PRIMARY KEY(user_id,revision)
);
CREATE INDEX IF NOT EXISTS cloud_versions_date ON cloud_save_versions(user_id,updated_at DESC);
ALTER TABLE game_guides ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE cloud_save_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON game_guides,content_reports,cloud_save_versions FROM PUBLIC;
CREATE TABLE IF NOT EXISTS topic_follows (
 user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
 post_id TEXT REFERENCES posts(id) ON DELETE CASCADE,
 enabled BOOLEAN NOT NULL,PRIMARY KEY(user_id,post_id)
);
CREATE TABLE IF NOT EXISTS game_requests (
 id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 title TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','searching','added')),
 game_id TEXT REFERENCES games(id) ON DELETE SET NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS game_updates (
 id TEXT PRIMARY KEY,game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
 body TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE topic_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_updates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON topic_follows,game_requests,game_updates FROM PUBLIC;

ALTER TABLE game_checks ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'works' CHECK (status IN ('works','graphics','network','startup'));

ALTER TABLE game_checks ADD COLUMN IF NOT EXISTS configuration TEXT NOT NULL DEFAULT '';

-- Shared across serverless instances; no browser/PostgREST access.
CREATE TABLE IF NOT EXISTS rate_limits (
 key TEXT PRIMARY KEY,hits BIGINT NOT NULL,expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS rate_limits_expiry ON rate_limits(expires_at);
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON rate_limits FROM PUBLIC;

-- Discovery metadata is explicit: NULL means unknown, never inferred from visibility.
ALTER TABLE games ADD COLUMN IF NOT EXISTS developer TEXT NOT NULL DEFAULT '';
ALTER TABLE games ADD COLUMN IF NOT EXISTS release_year INTEGER CHECK(release_year BETWEEN 1980 AND 2100);
ALTER TABLE games ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT '';
ALTER TABLE games ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT '';
ALTER TABLE games ADD COLUMN IF NOT EXISTS network_mode TEXT CHECK(network_mode IN ('online','offline'));
ALTER TABLE games ADD COLUMN IF NOT EXISTS nostalgic BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE history ADD COLUMN IF NOT EXISTS play_seconds BIGINT NOT NULL DEFAULT 0 CHECK(play_seconds>=0);
ALTER TABLE history ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS play_session TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS play_game TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS play_heartbeat TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS game_cloud_saves (
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
 revision TEXT PRIMARY KEY, data BYTEA NOT NULL, sha256 TEXT NOT NULL,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS game_cloud_saves_owner ON game_cloud_saves(user_id,game_id,updated_at DESC);
ALTER TABLE game_cloud_saves ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON game_cloud_saves FROM PUBLIC;
ALTER TABLE games ADD COLUMN IF NOT EXISTS inspection JSONB;
ALTER TABLE games ADD COLUMN IF NOT EXISTS inspected_at TIMESTAMPTZ;
ALTER TABLE games ADD COLUMN IF NOT EXISTS preservation JSONB NOT NULL DEFAULT '{}';
ALTER TABLE games ADD COLUMN IF NOT EXISTS boot_state TEXT CHECK(boot_state IN ('queued','running','review','captured','error'));
ALTER TABLE games ADD COLUMN IF NOT EXISTS boot_token TEXT;
ALTER TABLE games ADD COLUMN IF NOT EXISTS boot_started TIMESTAMPTZ;
ALTER TABLE games ADD COLUMN IF NOT EXISTS boot_report JSONB;
