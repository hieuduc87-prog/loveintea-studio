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
    CREATE TABLE IF NOT EXISTS posts (
      id          TEXT PRIMARY KEY,
      sku_id      TEXT NOT NULL,
      segment_id  TEXT,
      rtb_id      TEXT,
      usp_id      TEXT,
      narrative   TEXT,
      format      TEXT,
      context_id  TEXT,
      caption     TEXT,
      image_url   TEXT,
      image_prompt TEXT,
      status      TEXT DEFAULT 'draft',
      platform    TEXT DEFAULT 'instagram',
      scheduled_at TEXT,
      published_at TEXT,
      fb_post_id  TEXT,
      ig_post_id  TEXT,
      notes       TEXT,
      created_at  TEXT DEFAULT (datetime('now')),
      updated_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS blog_posts (
      id          TEXT PRIMARY KEY,
      sku_id      TEXT,
      topic       TEXT NOT NULL,
      title       TEXT,
      slug        TEXT UNIQUE,
      excerpt     TEXT,
      content     TEXT,
      status      TEXT DEFAULT 'draft',
      published_at TEXT,
      created_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS inbox_messages (
      id           TEXT PRIMARY KEY,
      platform     TEXT NOT NULL,
      sender_id    TEXT,
      sender_name  TEXT,
      message_type TEXT DEFAULT 'message',
      text         TEXT,
      is_read      BOOLEAN DEFAULT 0,
      received_at  TEXT DEFAULT (datetime('now')),
      raw_json     TEXT
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS image_jobs (
      id            TEXT PRIMARY KEY,
      post_id       TEXT,
      sku_id        TEXT NOT NULL,
      prompt        TEXT NOT NULL,
      scene         TEXT,
      status        TEXT DEFAULT 'pending',
      result_url    TEXT,
      error         TEXT,
      created_at    TEXT DEFAULT (datetime('now')),
      completed_at  TEXT
    );
  `);
}
