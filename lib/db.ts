import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(process.cwd(), 'data', 'studio.db');

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
    -- Content posts queue
    CREATE TABLE IF NOT EXISTS posts (
      id           TEXT PRIMARY KEY,
      sku_id       TEXT NOT NULL,
      segment_id   TEXT,
      rtb_id       TEXT,
      usp_id       TEXT,
      narrative    TEXT,
      format       TEXT,
      context_id   TEXT,
      caption      TEXT,
      image_url    TEXT,
      image_prompt TEXT,
      image_job_id TEXT,
      status       TEXT DEFAULT 'draft',
      platform     TEXT DEFAULT 'instagram',
      scheduled_at TEXT,
      published_at TEXT,
      fb_post_id   TEXT,
      ig_post_id   TEXT,
      notes        TEXT,
      created_at   TEXT DEFAULT (datetime('now')),
      updated_at   TEXT DEFAULT (datetime('now'))
    );

    -- Image generation job queue
    CREATE TABLE IF NOT EXISTS image_jobs (
      id           TEXT PRIMARY KEY,
      post_id      TEXT,
      sku_id       TEXT NOT NULL,
      usp_id       TEXT,
      context_id   TEXT,
      prompt       TEXT NOT NULL,
      use_edit     INTEGER DEFAULT 1,
      status       TEXT DEFAULT 'pending',
      result_url   TEXT,
      error        TEXT,
      duration_ms  INTEGER,
      model        TEXT DEFAULT 'gpt-image-1',
      created_at   TEXT DEFAULT (datetime('now')),
      completed_at TEXT
    );

    -- Image library — all generated images
    CREATE TABLE IF NOT EXISTS image_library (
      id           TEXT PRIMARY KEY,
      job_id       TEXT,
      sku_id       TEXT NOT NULL,
      usp_id       TEXT,
      context_id   TEXT,
      prompt       TEXT,
      image_url    TEXT NOT NULL,
      width        INTEGER DEFAULT 1024,
      height       INTEGER DEFAULT 1536,
      model        TEXT DEFAULT 'gpt-image-1',
      used_in_post TEXT,
      tags         TEXT DEFAULT '[]',
      is_favorite  INTEGER DEFAULT 0,
      created_at   TEXT DEFAULT (datetime('now'))
    );

    -- Blog posts
    CREATE TABLE IF NOT EXISTS blog_posts (
      id           TEXT PRIMARY KEY,
      sku_id       TEXT,
      topic        TEXT NOT NULL,
      title        TEXT,
      slug         TEXT UNIQUE,
      excerpt      TEXT,
      content      TEXT,
      status       TEXT DEFAULT 'draft',
      published_at TEXT,
      created_at   TEXT DEFAULT (datetime('now'))
    );

    -- Inbox messages
    CREATE TABLE IF NOT EXISTS inbox_messages (
      id           TEXT PRIMARY KEY,
      platform     TEXT NOT NULL,
      sender_id    TEXT,
      sender_name  TEXT,
      message_type TEXT DEFAULT 'message',
      text         TEXT,
      is_read      INTEGER DEFAULT 0,
      received_at  TEXT DEFAULT (datetime('now')),
      raw_json     TEXT
    );

    -- Settings
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_posts_status     ON posts(status);
    CREATE INDEX IF NOT EXISTS idx_posts_sku        ON posts(sku_id);
    CREATE INDEX IF NOT EXISTS idx_image_jobs_status ON image_jobs(status);
    CREATE INDEX IF NOT EXISTS idx_image_lib_sku    ON image_library(sku_id);
    CREATE INDEX IF NOT EXISTS idx_image_lib_fav    ON image_library(is_favorite);
  `);
}
