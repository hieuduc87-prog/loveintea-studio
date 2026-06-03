import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// DATA_DIR must point outside .next/ so data survives next build
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'studio.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  initSchema(_db);
  return _db;
}

function initSchema(db: Database.Database) {
  db.exec(`

    -- ─────────────────────────────────────────────
    -- SETTINGS — key/value config store
    -- ─────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS settings (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL DEFAULT '',
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- ─────────────────────────────────────────────
    -- BATCH RUNS — group multi-job generations
    -- ─────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS batch_runs (
      id         TEXT PRIMARY KEY,
      label      TEXT,                         -- e.g. "Dandelion × Morning × 3 USPs"
      total      INTEGER DEFAULT 0,
      done       INTEGER DEFAULT 0,
      failed     INTEGER DEFAULT 0,
      status     TEXT DEFAULT 'running',       -- running | done | partial
      created_at TEXT DEFAULT (datetime('now')),
      finished_at TEXT
    );

    -- ─────────────────────────────────────────────
    -- IMAGE JOBS — gpt-image-2 generation queue
    -- ─────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS image_jobs (
      id           TEXT PRIMARY KEY,
      batch_id     TEXT REFERENCES batch_runs(id),
      sku_id       TEXT NOT NULL,
      usp_id       TEXT NOT NULL DEFAULT '',
      context_id   TEXT NOT NULL DEFAULT '',
      prompt       TEXT NOT NULL,
      use_edit     INTEGER DEFAULT 1,          -- 1=edit mode, 0=generate
      status       TEXT DEFAULT 'pending',     -- pending | running | done | failed
      result_url   TEXT,
      error        TEXT,
      duration_ms  INTEGER,
      model        TEXT DEFAULT 'gpt-image-2',
      created_at   TEXT DEFAULT (datetime('now')),
      completed_at TEXT
    );

    -- ─────────────────────────────────────────────
    -- IMAGE LIBRARY — all generated images
    -- ─────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS image_library (
      id           TEXT PRIMARY KEY,
      job_id       TEXT REFERENCES image_jobs(id),
      sku_id       TEXT NOT NULL,
      usp_id       TEXT DEFAULT '',
      context_id   TEXT DEFAULT '',
      prompt       TEXT,
      image_url    TEXT NOT NULL,
      width        INTEGER DEFAULT 1024,
      height       INTEGER DEFAULT 1536,
      model        TEXT DEFAULT 'gpt-image-2',
      tags         TEXT DEFAULT '[]',          -- JSON array of tags
      is_favorite  INTEGER DEFAULT 0,
      used_in_post TEXT,                       -- post id if used
      created_at   TEXT DEFAULT (datetime('now'))
    );

    -- ─────────────────────────────────────────────
    -- POSTS — content queue (caption + image pairs)
    -- ─────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS posts (
      id              TEXT PRIMARY KEY,
      batch_id        TEXT REFERENCES batch_runs(id),

      -- O3 content config
      sku_id          TEXT NOT NULL,
      segment_id      TEXT DEFAULT '',
      rtb_id          TEXT DEFAULT '',
      usp_id          TEXT DEFAULT '',
      narrative_id    TEXT DEFAULT '',
      context_id      TEXT DEFAULT '',
      cta             TEXT DEFAULT '',
      cell_id         TEXT DEFAULT '',         -- O3 unique combination ID

      -- Content
      caption         TEXT,
      hashtags        TEXT DEFAULT '',
      image_prompt    TEXT,                    -- Gemini-generated image brief
      image_url       TEXT,                    -- final image (from gpt-image-2)
      image_job_id    TEXT REFERENCES image_jobs(id),

      -- Publish targets
      platforms       TEXT DEFAULT 'facebook', -- 'facebook' | 'instagram' | 'facebook,instagram'

      -- Status flow: draft → scheduled → published | failed
      status          TEXT DEFAULT 'draft',

      -- Scheduling
      scheduled_at    TEXT,                    -- ISO datetime for scheduled posts

      -- Publish results
      published_at    TEXT,
      fb_post_id      TEXT,                    -- ID of live FB post
      fb_scheduled_id TEXT,                    -- ID of FB scheduled post (before publish time)
      ig_post_id      TEXT,                    -- ID of IG post

      -- Meta
      notes           TEXT,
      created_at      TEXT DEFAULT (datetime('now')),
      updated_at      TEXT DEFAULT (datetime('now'))
    );

    -- ─────────────────────────────────────────────
    -- PUBLISH LOG — audit trail for all publish attempts
    -- ─────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS publish_log (
      id           TEXT PRIMARY KEY,
      post_id      TEXT REFERENCES posts(id),
      platform     TEXT NOT NULL,              -- facebook | instagram
      action       TEXT NOT NULL,              -- publish_now | schedule
      status       TEXT NOT NULL,              -- ok | failed
      result_id    TEXT,                       -- platform post ID on success
      error        TEXT,                       -- error message on failure
      scheduled_at TEXT,                       -- if action=schedule, the target time
      created_at   TEXT DEFAULT (datetime('now'))
    );

    -- ─────────────────────────────────────────────
    -- BLOG POSTS
    -- ─────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS blog_posts (
      id           TEXT PRIMARY KEY,
      sku_id       TEXT DEFAULT '',
      topic        TEXT NOT NULL,
      title        TEXT,
      slug         TEXT UNIQUE,
      excerpt      TEXT,
      content      TEXT,
      status       TEXT DEFAULT 'draft',       -- draft | published
      published_at TEXT,
      created_at   TEXT DEFAULT (datetime('now'))
    );

    -- ─────────────────────────────────────────────
    -- INBOX — FB/IG messages & comments
    -- ─────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS inbox_messages (
      id           TEXT PRIMARY KEY,
      platform     TEXT NOT NULL,              -- facebook | instagram
      message_type TEXT DEFAULT 'message',     -- message | comment | mention
      sender_id    TEXT,
      sender_name  TEXT,
      text         TEXT,
      post_id      TEXT,                       -- FB/IG post this comment belongs to
      is_read      INTEGER DEFAULT 0,
      replied      INTEGER DEFAULT 0,
      reply_text   TEXT,
      received_at  TEXT DEFAULT (datetime('now')),
      raw_json     TEXT
    );

    -- ─────────────────────────────────────────────
    -- INDEXES
    -- ─────────────────────────────────────────────
    CREATE INDEX IF NOT EXISTS idx_posts_status      ON posts(status);
    CREATE INDEX IF NOT EXISTS idx_posts_sku         ON posts(sku_id);
    CREATE INDEX IF NOT EXISTS idx_posts_scheduled   ON posts(scheduled_at) WHERE scheduled_at IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_posts_cell        ON posts(cell_id) WHERE cell_id != '';
    CREATE INDEX IF NOT EXISTS idx_image_jobs_status ON image_jobs(status);
    CREATE INDEX IF NOT EXISTS idx_image_jobs_batch  ON image_jobs(batch_id) WHERE batch_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_image_lib_sku     ON image_library(sku_id);
    CREATE INDEX IF NOT EXISTS idx_image_lib_fav     ON image_library(is_favorite);
    CREATE INDEX IF NOT EXISTS idx_publish_log_post  ON publish_log(post_id);
    CREATE INDEX IF NOT EXISTS idx_inbox_read        ON inbox_messages(is_read);
    CREATE INDEX IF NOT EXISTS idx_inbox_platform    ON inbox_messages(platform);
  `);
}
