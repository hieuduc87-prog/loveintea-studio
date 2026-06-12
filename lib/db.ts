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
    -- CONTENT TEMPLATES — reusable visual templates
    -- ─────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS content_templates (
      id           TEXT PRIMARY KEY,
      brand_id     TEXT NOT NULL DEFAULT 'loveintea',
      name         TEXT NOT NULL,
      category     TEXT NOT NULL DEFAULT 'general',  -- layout | promo | story | quote | product | event | seasonal | general
      purpose      TEXT DEFAULT '',                   -- e.g. "flash sale", "new launch", "testimonial"
      format       TEXT DEFAULT 'post',               -- post | story | reel_cover | carousel | banner
      aspect_ratio TEXT DEFAULT '2:3',                -- 1:1 | 4:5 | 2:3 | 9:16 | 16:9
      image_url    TEXT NOT NULL,
      thumbnail_url TEXT,
      tags         TEXT DEFAULT '[]',                 -- JSON array of style tags
      color_palette TEXT DEFAULT '',                  -- dominant colors description
      notes        TEXT DEFAULT '',
      analysis     TEXT DEFAULT '',                 -- JSON: Gemini vision layout analysis
      is_active    INTEGER DEFAULT 1,
      usage_count  INTEGER DEFAULT 0,
      created_at   TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_content_tpl_brand    ON content_templates(brand_id);
    CREATE INDEX IF NOT EXISTS idx_content_tpl_category ON content_templates(category);
    CREATE INDEX IF NOT EXISTS idx_content_tpl_format   ON content_templates(format);
    CREATE INDEX IF NOT EXISTS idx_content_tpl_active   ON content_templates(is_active);

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

    -- ═════════════════════════════════════════════════
    -- MULTI-BRAND MARKETING SYSTEM (Layer 1-5)
    -- ═════════════════════════════════════════════════

    -- ─── Layer 1: Organization ───────────────────────
    CREATE TABLE IF NOT EXISTS brands (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      slug        TEXT UNIQUE NOT NULL,
      logo_url    TEXT,
      domain      TEXT,
      created_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS brand_settings (
      id          TEXT PRIMARY KEY,
      brand_id    TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
      key         TEXT NOT NULL,
      value       TEXT NOT NULL DEFAULT '',
      updated_at  TEXT DEFAULT (datetime('now')),
      UNIQUE(brand_id, key)
    );

    -- ─── Layer 2: Strategy ───────────────────────────
    CREATE TABLE IF NOT EXISTS brand_dna (
      id              TEXT PRIMARY KEY,
      brand_id        TEXT UNIQUE NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
      tagline         TEXT,
      archetype       TEXT,
      through_line    TEXT,
      colors_json     TEXT DEFAULT '{}',
      typography_json TEXT DEFAULT '{}',
      voice_traits    TEXT DEFAULT '[]',
      compliance_json TEXT DEFAULT '{}',
      hashtags        TEXT DEFAULT '[]',
      updated_at      TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS products (
      id              TEXT PRIMARY KEY,
      brand_id        TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
      slug            TEXT NOT NULL,
      name            TEXT NOT NULL,
      display_name    TEXT,
      theme           TEXT,
      color           TEXT,
      color_name      TEXT,
      ingredients     TEXT DEFAULT '[]',
      image_url       TEXT,
      best_moment     TEXT,
      use_cases       TEXT DEFAULT '[]',
      pitch           TEXT,
      sort_order      INTEGER DEFAULT 0,
      created_at      TEXT DEFAULT (datetime('now')),
      UNIQUE(brand_id, slug)
    );

    CREATE TABLE IF NOT EXISTS product_images (
      id              TEXT PRIMARY KEY,
      brand_id        TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
      product_id      TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      image_url       TEXT NOT NULL,
      type            TEXT DEFAULT 'photo',     -- photo|packshot|lifestyle|macro|flat-lay
      caption         TEXT,
      is_hero         INTEGER DEFAULT 0,
      sort_order      INTEGER DEFAULT 0,
      created_at      TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audiences (
      id              TEXT PRIMARY KEY,
      brand_id        TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
      code            TEXT NOT NULL,
      name            TEXT NOT NULL,
      age_range       TEXT,
      tension         TEXT,
      lead_product_ids TEXT DEFAULT '[]',
      sort_order      INTEGER DEFAULT 0,
      UNIQUE(brand_id, code)
    );

    CREATE TABLE IF NOT EXISTS variables (
      id              TEXT PRIMARY KEY,
      brand_id        TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
      type            TEXT NOT NULL,
      code            TEXT NOT NULL,
      label           TEXT NOT NULL,
      data_json       TEXT DEFAULT '{}',
      product_ids     TEXT DEFAULT '[]',
      audience_ids    TEXT DEFAULT '[]',
      sort_order      INTEGER DEFAULT 0,
      UNIQUE(brand_id, type, code)
    );

    CREATE TABLE IF NOT EXISTS channels (
      id              TEXT PRIMARY KEY,
      brand_id        TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
      platform        TEXT NOT NULL,
      name            TEXT,
      credentials     TEXT DEFAULT '{}',
      status          TEXT DEFAULT 'active',
      created_at      TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS knowledge_docs (
      id              TEXT PRIMARY KEY,
      brand_id        TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
      type            TEXT NOT NULL,
      title           TEXT NOT NULL,
      content         TEXT,
      file_url        TEXT,
      uploaded_at     TEXT DEFAULT (datetime('now'))
    );

    -- ─── Layer 3: Planning ───────────────────────────
    CREATE TABLE IF NOT EXISTS campaigns (
      id              TEXT PRIMARY KEY,
      brand_id        TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
      name            TEXT NOT NULL,
      objective       TEXT,
      start_date      TEXT,
      end_date        TEXT,
      status          TEXT DEFAULT 'planning',
      created_at      TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS content_plans (
      id              TEXT PRIMARY KEY,
      brand_id        TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
      campaign_id     TEXT REFERENCES campaigns(id),
      title           TEXT NOT NULL,
      through_line    TEXT,
      cadence         TEXT,
      wave_structure  TEXT DEFAULT '[]',
      stories_json    TEXT DEFAULT '{}',
      summary_json    TEXT DEFAULT '{}',
      source_file     TEXT,
      created_at      TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS plan_items (
      id              TEXT PRIMARY KEY,
      plan_id         TEXT NOT NULL REFERENCES content_plans(id) ON DELETE CASCADE,
      brand_id        TEXT NOT NULL REFERENCES brands(id),
      date            TEXT,
      day_of_week     TEXT,
      wave            TEXT,
      surface         TEXT,
      purpose         TEXT,
      pillar          TEXT,
      product_id      TEXT,
      audience_code   TEXT,
      rtb_code        TEXT,
      usp_code        TEXT,
      context         TEXT,
      hook            TEXT,
      copy_direction  TEXT,
      visual_direction TEXT,
      hashtags        TEXT,
      repurpose       TEXT,
      tree_id         TEXT,
      win_band        TEXT,
      sort_order      INTEGER DEFAULT 0
    );

    -- ─── Layer 5: Intelligence ───────────────────────
    CREATE TABLE IF NOT EXISTS post_metrics (
      id              TEXT PRIMARY KEY,
      post_id         TEXT REFERENCES posts(id),
      brand_id        TEXT,
      platform        TEXT NOT NULL,
      fetched_at      TEXT DEFAULT (datetime('now')),
      reach           INTEGER DEFAULT 0,
      impressions     INTEGER DEFAULT 0,
      engaged         INTEGER DEFAULT 0,
      reactions       INTEGER DEFAULT 0,
      comments        INTEGER DEFAULT 0,
      shares          INTEGER DEFAULT 0,
      saves           INTEGER DEFAULT 0,
      sends           INTEGER DEFAULT 0,
      link_clicks     INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS variable_scores (
      id              TEXT PRIMARY KEY,
      brand_id        TEXT,
      variable_id     TEXT,
      product_id      TEXT,
      metric          TEXT NOT NULL,
      avg_score       REAL DEFAULT 0,
      sample_size     INTEGER DEFAULT 0,
      period          TEXT,
      updated_at      TEXT DEFAULT (datetime('now')),
      UNIQUE(brand_id, variable_id, product_id, metric, period)
    );

    CREATE TABLE IF NOT EXISTS insights (
      id              TEXT PRIMARY KEY,
      brand_id        TEXT,
      type            TEXT NOT NULL,
      title           TEXT NOT NULL,
      description     TEXT,
      evidence_json   TEXT,
      priority        INTEGER DEFAULT 5,
      status          TEXT DEFAULT 'new',
      created_at      TEXT DEFAULT (datetime('now'))
    );

    -- ─── Indexes for new tables ──────────────────────
    CREATE INDEX IF NOT EXISTS idx_products_brand     ON products(brand_id);
    CREATE INDEX IF NOT EXISTS idx_product_imgs_prod  ON product_images(product_id);
    CREATE INDEX IF NOT EXISTS idx_variables_brand    ON variables(brand_id, type);
    CREATE INDEX IF NOT EXISTS idx_plan_items_plan    ON plan_items(plan_id);
    CREATE INDEX IF NOT EXISTS idx_post_metrics_post  ON post_metrics(post_id);

    -- ═════════════════════════════════════════════════
    -- AUTH TABLES (NextAuth)
    -- ═════════════════════════════════════════════════

    CREATE TABLE IF NOT EXISTS auth_accounts (
      id                   TEXT PRIMARY KEY,
      user_id              TEXT NOT NULL,
      type                 TEXT NOT NULL,
      provider             TEXT NOT NULL,
      provider_account_id  TEXT NOT NULL,
      refresh_token        TEXT,
      access_token         TEXT,
      expires_at           INTEGER,
      token_type           TEXT,
      scope                TEXT,
      id_token             TEXT,
      session_state        TEXT,
      UNIQUE(provider, provider_account_id)
    );

    CREATE TABLE IF NOT EXISTS auth_sessions (
      id            TEXT PRIMARY KEY,
      session_token TEXT NOT NULL UNIQUE,
      user_id       TEXT NOT NULL,
      expires       TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS auth_users (
      id             TEXT PRIMARY KEY,
      name           TEXT,
      email          TEXT UNIQUE NOT NULL,
      email_verified TEXT,
      image          TEXT,
      role           TEXT NOT NULL DEFAULT 'viewer',
      is_approved    INTEGER NOT NULL DEFAULT 0,
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      last_login     TEXT
    );

    CREATE TABLE IF NOT EXISTS auth_verification_tokens (
      identifier TEXT NOT NULL,
      token      TEXT NOT NULL,
      expires    TEXT NOT NULL,
      UNIQUE(identifier, token)
    );

    CREATE INDEX IF NOT EXISTS idx_auth_accounts_user    ON auth_accounts(user_id);
    CREATE INDEX IF NOT EXISTS idx_auth_sessions_user    ON auth_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_auth_sessions_token   ON auth_sessions(session_token);

    -- ═════════════════════════════════════════════════
    -- FACEBOOK OAUTH CONNECTIONS (multi-user ready)
    -- ═════════════════════════════════════════════════

    -- One row per (app user, FB user) pair. Stores encrypted long-lived user token.
    CREATE TABLE IF NOT EXISTS fb_connections (
      id              TEXT PRIMARY KEY,
      user_id         TEXT NOT NULL,              -- 'owner' (single-user) or auth_users.id
      fb_user_id      TEXT NOT NULL,
      fb_user_name    TEXT,
      user_token_enc  TEXT NOT NULL,              -- AES-256-GCM encrypted long-lived user token
      user_token_iv   TEXT NOT NULL,
      user_token_tag  TEXT NOT NULL,
      expires_at      TEXT NOT NULL,              -- ISO datetime
      created_at      TEXT DEFAULT (datetime('now')),
      updated_at      TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, fb_user_id)
    );

    -- One row per Facebook Page the user manages. Page tokens are never-expiring.
    CREATE TABLE IF NOT EXISTS fb_pages (
      id              TEXT PRIMARY KEY,
      connection_id   TEXT NOT NULL REFERENCES fb_connections(id) ON DELETE CASCADE,
      page_id         TEXT NOT NULL,              -- Facebook Page ID
      page_name       TEXT NOT NULL,
      page_token_enc  TEXT NOT NULL,              -- AES-256-GCM encrypted page access token
      page_token_iv   TEXT NOT NULL,
      page_token_tag  TEXT NOT NULL,
      ig_account_id   TEXT DEFAULT '',            -- Linked Instagram Business Account ID
      is_active       INTEGER DEFAULT 0,          -- 1 = currently selected for posting
      created_at      TEXT DEFAULT (datetime('now')),
      UNIQUE(connection_id, page_id)
    );

    CREATE INDEX IF NOT EXISTS idx_fb_pages_conn   ON fb_pages(connection_id);
    CREATE INDEX IF NOT EXISTS idx_fb_pages_active ON fb_pages(is_active);

    -- ═══════════════════════════════════════════════════════
    -- HUB EXTENSION — DAM + Content Log + Payment
    -- ═══════════════════════════════════════════════════════

    CREATE TABLE IF NOT EXISTS assets (
      id            TEXT PRIMARY KEY,
      brand_id      TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
      product_id    TEXT REFERENCES products(id) ON DELETE SET NULL,
      url           TEXT NOT NULL,
      filename      TEXT NOT NULL,
      file_type     TEXT DEFAULT 'image',
      file_size     INTEGER,
      width         INTEGER,
      height        INTEGER,
      status        TEXT DEFAULT 'unused',   -- unused | scheduled | aired
      source        TEXT DEFAULT 'upload',   -- upload | generated
      source_job_id TEXT,
      notes         TEXT,
      created_by    TEXT,
      created_at    TEXT DEFAULT (datetime('now')),
      updated_at    TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tags (
      id         TEXT PRIMARY KEY,
      brand_id   TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
      name       TEXT NOT NULL,
      slug       TEXT NOT NULL,
      type       TEXT DEFAULT 'custom',     -- product | brand | content_goal | format | season | occasion | custom
      color      TEXT DEFAULT '#6b7280',
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(brand_id, slug)
    );

    CREATE TABLE IF NOT EXISTS asset_tags (
      asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      tag_id   TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (asset_id, tag_id)
    );

    CREATE TABLE IF NOT EXISTS content_log (
      id           TEXT PRIMARY KEY,
      brand_id     TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
      product_id   TEXT REFERENCES products(id) ON DELETE SET NULL,
      title        TEXT,
      caption      TEXT,
      content_type TEXT DEFAULT 'post',     -- post | reel | story | carousel | video | blog
      platform     TEXT DEFAULT 'instagram',-- facebook | instagram | tiktok | youtube | other
      status       TEXT DEFAULT 'draft',    -- draft | scheduled | aired
      scheduled_at TEXT,
      aired_at     TEXT,
      post_url     TEXT,
      notes        TEXT,
      created_by   TEXT,
      created_at   TEXT DEFAULT (datetime('now')),
      updated_at   TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS content_log_assets (
      content_id TEXT NOT NULL REFERENCES content_log(id) ON DELETE CASCADE,
      asset_id   TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      PRIMARY KEY (content_id, asset_id)
    );

    CREATE TABLE IF NOT EXISTS payment_plans (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      type        TEXT NOT NULL,             -- setup_once | subscription_monthly
      price       INTEGER NOT NULL,          -- VND
      description TEXT,
      features    TEXT DEFAULT '[]',
      is_active   INTEGER DEFAULT 1,
      created_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS bank_transfers (
      id              TEXT PRIMARY KEY,
      order_id        TEXT UNIQUE NOT NULL,
      user_id         TEXT NOT NULL,
      plan_id         TEXT NOT NULL,
      amount          INTEGER NOT NULL,
      status          TEXT DEFAULT 'pending', -- pending | paid | expired
      metadata        TEXT DEFAULT '{}',
      casso_tid       TEXT,
      sender_name     TEXT,
      sender_account  TEXT,
      paid_at         TEXT,
      expires_at      TEXT,
      created_at      TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id                  TEXT PRIMARY KEY,
      user_id             TEXT NOT NULL,
      plan_id             TEXT NOT NULL,
      status              TEXT DEFAULT 'active', -- active | expired | cancelled
      started_at          TEXT NOT NULL,
      current_period_end  TEXT NOT NULL,
      payment_method      TEXT DEFAULT 'bank_transfer',
      payment_reference   TEXT,
      created_at          TEXT DEFAULT (datetime('now')),
      updated_at          TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_assets_brand     ON assets(brand_id);
    CREATE INDEX IF NOT EXISTS idx_assets_product   ON assets(product_id);
    CREATE INDEX IF NOT EXISTS idx_assets_status    ON assets(status);
    CREATE INDEX IF NOT EXISTS idx_tags_brand       ON tags(brand_id);
    CREATE INDEX IF NOT EXISTS idx_asset_tags_tag   ON asset_tags(tag_id);
    CREATE INDEX IF NOT EXISTS idx_content_brand    ON content_log(brand_id);
    CREATE INDEX IF NOT EXISTS idx_content_status   ON content_log(status);
    CREATE INDEX IF NOT EXISTS idx_subs_user        ON subscriptions(user_id);
  `);

  // ══════════════════════════════════════════════════════
  // CLOSED-LOOP ENGINE — Briefs, Rules, Scoreboard
  // ══════════════════════════════════════════════════════

  db.exec(`
    -- Briefs: generated from plan items, carry lineage
    CREATE TABLE IF NOT EXISTS briefs (
      id              TEXT PRIMARY KEY,
      brand_id        TEXT NOT NULL,
      plan_item_id    TEXT,
      rule_version    TEXT DEFAULT 'v1.0',
      purpose         TEXT,
      variable_cell   TEXT,
      channel         TEXT DEFAULT 'instagram',
      format          TEXT,
      copy_direction  TEXT,
      visual_direction TEXT,
      sku_id          TEXT,
      segment_id      TEXT,
      rtb_id          TEXT,
      usp_id          TEXT,
      context_id      TEXT,
      status          TEXT DEFAULT 'draft',
      created_at      TEXT DEFAULT (datetime('now'))
    );

    -- Rules Engine: versioned brand rules (max 30 active)
    CREATE TABLE IF NOT EXISTS content_rules (
      id              TEXT PRIMARY KEY,
      brand_id        TEXT NOT NULL,
      version         TEXT NOT NULL,
      rule_text       TEXT NOT NULL,
      evidence        TEXT,
      source          TEXT DEFAULT 'manual',
      replaces_rule_id TEXT,
      status          TEXT DEFAULT 'active',
      created_at      TEXT DEFAULT (datetime('now')),
      retired_at      TEXT
    );

    -- Scoreboard: performance verdict per angle
    CREATE TABLE IF NOT EXISTS scoreboard (
      id              TEXT PRIMARY KEY,
      brand_id        TEXT NOT NULL,
      angle           TEXT NOT NULL,
      channel         TEXT NOT NULL,
      saves           INTEGER DEFAULT 0,
      reach           INTEGER DEFAULT 0,
      er              REAL DEFAULT 0,
      sample_size     INTEGER DEFAULT 0,
      verdict         TEXT DEFAULT 'HOLD',
      evidence_json   TEXT,
      updated_at      TEXT DEFAULT (datetime('now')),
      UNIQUE(brand_id, angle, channel)
    );

    -- Brand membership: which users can access which brands.
    -- Admins/root_admins see all brands. Non-admins with rows here are
    -- scoped to those brands; non-admins with NO rows see all (legacy).
    CREATE TABLE IF NOT EXISTS brand_members (
      user_id    TEXT NOT NULL,
      brand_id   TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
      role       TEXT DEFAULT 'member',
      created_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, brand_id)
    );
    CREATE INDEX IF NOT EXISTS idx_brand_members_user ON brand_members(user_id);

    CREATE INDEX IF NOT EXISTS idx_briefs_brand   ON briefs(brand_id);
    CREATE INDEX IF NOT EXISTS idx_briefs_status   ON briefs(status);
    CREATE INDEX IF NOT EXISTS idx_rules_brand     ON content_rules(brand_id, status);
    CREATE INDEX IF NOT EXISTS idx_scoreboard_brand ON scoreboard(brand_id);
  `);

  // ── Migrations ─────────────────────────────────────
  try { db.exec(`ALTER TABLE posts ADD COLUMN plan_id TEXT REFERENCES content_plans(id)`); } catch { /* already exists */ }
  try { db.exec(`ALTER TABLE posts ADD COLUMN brand_id TEXT DEFAULT 'loveintea'`); } catch { /* already exists */ }
  // Lineage columns for closed-loop attribution
  try { db.exec(`ALTER TABLE posts ADD COLUMN brief_id TEXT`); } catch { /* already exists */ }
  try { db.exec(`ALTER TABLE posts ADD COLUMN rule_version TEXT DEFAULT 'v1.0'`); } catch { /* already exists */ }
  try { db.exec(`ALTER TABLE posts ADD COLUMN plan_item_id TEXT`); } catch { /* already exists */ }
  try { db.exec(`ALTER TABLE posts ADD COLUMN review_status TEXT DEFAULT 'pending'`); } catch { /* already exists */ }
  try { db.exec(`ALTER TABLE posts ADD COLUMN review_notes TEXT`); } catch { /* already exists */ }
  try { db.exec(`ALTER TABLE content_templates ADD COLUMN analysis TEXT DEFAULT ''`); } catch { /* already exists */ }
  try { db.exec(`ALTER TABLE content_templates ADD COLUMN file_type TEXT DEFAULT 'image'`); } catch { /* already exists */ }
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS momo_payments (
        id            TEXT PRIMARY KEY,
        user_id       TEXT NOT NULL,
        order_id      TEXT UNIQUE NOT NULL,
        plan_id       TEXT NOT NULL,
        amount        INTEGER NOT NULL,
        status        TEXT DEFAULT 'pending',
        pay_url       TEXT,
        qr_code_url   TEXT,
        momo_trans_id TEXT,
        paid_at       TEXT,
        created_at    TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_momo_order ON momo_payments(order_id);
    `);
  } catch { /* already exists */ }

  // ── Seed root users ────────────────────────────────
  db.exec(`
    INSERT OR IGNORE INTO auth_users (id, name, email, role, is_approved, created_at)
    VALUES ('root-duc', 'Duc Hieu', 'hieuduc87@gmail.com', 'root_admin', 1, datetime('now'));

    UPDATE auth_users SET role='root_admin', is_approved=1 WHERE email='hieuduc87@gmail.com';

    INSERT OR IGNORE INTO auth_users (id, name, email, role, is_approved, created_at)
    VALUES ('root-son', 'Manh Son', 'manhson.nguyen@gmail.com', 'admin', 1, datetime('now'));
  `);

  // ── Seed default brand if not exists ──────────────
  seedDefaultBrand(db);

  // ── Migrate existing images → assets DAM ───────────
  try {
    db.exec(`
      INSERT OR IGNORE INTO assets
        (id, brand_id, product_id, url, filename, file_type, status, source, source_job_id, created_at, updated_at)
      SELECT il.id, 'loveintea', p.id, il.image_url,
             il.id || '.jpg', 'image', 'unused', 'generated', il.job_id,
             il.created_at, il.created_at
      FROM image_library il
      LEFT JOIN products p ON p.slug = il.sku_id AND p.brand_id = 'loveintea'
    `);
    db.exec(`
      INSERT OR IGNORE INTO assets
        (id, brand_id, product_id, url, filename, file_type, status, source, created_at, updated_at)
      SELECT pi.id, pi.brand_id, pi.product_id, pi.image_url,
             pi.id || '.jpg', 'image', 'unused', 'product_photo',
             pi.created_at, pi.created_at
      FROM product_images pi
    `);
  } catch { /* tables might not be populated */ }

  // ── Seed payment plans ─────────────────────────────
  try {
    db.exec(`
      INSERT OR IGNORE INTO payment_plans (id, name, type, price, description, features, is_active) VALUES
        ('plan-setup', 'Studio Setup', 'setup_once', 2000000,
         'Onboarding và thiết lập ban đầu: brand hub, sản phẩm, kênh social',
         '["Thiết lập Brand DNA & sản phẩm","Kết nối Facebook & Instagram","Thư viện ảnh (DAM)","Hướng dẫn sử dụng 1-1","Truy cập tính năng nền tảng trọn đời"]',
         1),
        ('plan-monthly', 'Studio Pro', 'subscription_monthly', 990000,
         'Đầy đủ tính năng Studio Pro cho toàn bộ team mỗi tháng',
         '["AI sinh content 30 bài/tháng","Image Studio (gpt-image-2)","Scheduler & Publisher","Analytics & Inbox","Team access tối đa 5 người","Hỗ trợ ưu tiên"]',
         1)
    `);
  } catch { /* already seeded */ }

  // ── Seed default tags ───────────────────────────────
  try {
    db.exec(`
      INSERT OR IGNORE INTO tags (id, brand_id, name, slug, type, color) VALUES
        ('tag-dandelion','loveintea','Dandelion','dandelion','product','#F4A020'),
        ('tag-ginger','loveintea','Ginger','ginger','product','#A8B525'),
        ('tag-hibiscus','loveintea','Hibiscus','hibiscus','product','#5B8C3E'),
        ('tag-lemon-balm','loveintea','Lemon Balm','lemon-balm','product','#8BBF5C'),
        ('tag-peppermint','loveintea','Peppermint','peppermint','product','#5BBCD2'),
        ('tag-nighty-night','loveintea','Nighty Night','nighty-night','product','#3F3D99'),
        ('tag-morning','loveintea','Morning','morning','season','#fcd34d'),
        ('tag-afternoon','loveintea','Afternoon','afternoon','season','#fb923c'),
        ('tag-evening','loveintea','Evening','evening','season','#818cf8'),
        ('tag-lifestyle','loveintea','Lifestyle','lifestyle','format','#6b7280'),
        ('tag-product-shot','loveintea','Product Shot','product-shot','format','#9ca3af'),
        ('tag-flat-lay','loveintea','Flat Lay','flat-lay','format','#c084fc'),
        ('tag-macro','loveintea','Macro','macro','format','#67e8f9'),
        ('tag-awareness','loveintea','Brand Awareness','awareness','content_goal','#60a5fa'),
        ('tag-engagement','loveintea','Engagement','engagement','content_goal','#34d399'),
        ('tag-promotion','loveintea','Promotion','promotion','content_goal','#f87171')
    `);
  } catch { /* already seeded */ }
}

function seedDefaultBrand(db: Database.Database) {
  const exists = db.prepare('SELECT 1 FROM brands WHERE id=?').get('loveintea');
  if (exists) return;

  db.prepare('INSERT INTO brands (id, name, slug, logo_url, domain) VALUES (?,?,?,?,?)').run(
    'loveintea', 'LoveinTea', 'loveintea', '/brand/logos/logo-green.png', 'loveintea.com'
  );

  db.prepare(`INSERT INTO brand_dna (id, brand_id, tagline, archetype, through_line, colors_json, typography_json, voice_traits, compliance_json, hashtags)
    VALUES (?,?,?,?,?,?,?,?,?,?)`).run(
    'dna-loveintea', 'loveintea', 'Timeless Remedies', 'The Joyful Healer',
    "Vietnam's timeless herbal remedies, made simple for your everyday calm.",
    JSON.stringify({"heritageGreen":"#1A5632","loveCoral":"#E04854","cottonCream":"#FFF8F0","deepEarth":"#2D2D2D","warmStone":"#8C8C8C","naturalWhite":"#F5F5F0"}),
    JSON.stringify({"display":"Sorean","body":"Lato"}),
    JSON.stringify(["Warmly Wise — gentle authority of a grandmother who knows her herbs","Cheerfully Simple — light, accessible, joyful; wellness feels like a treat","Proudly Vietnamese — celebrate heritage naturally, never exoticize"]),
    JSON.stringify({"neverSay":["cures","treats","heals","prevents disease","innovative","disrupting","mysterious","ancient secrets","exotic Eastern","optimize your wellness protocol"],"alwaysSay":["traditionally used to support","a soothing ritual for","plant-based corn-fiber pyramid","grown in the Vietnamese highlands","all-natural, zero calories"]}),
    JSON.stringify(["#LoveinTea","#TimelessRemedies","#VietnameseHerbs"])
  );

  // Seed products
  const productInsert = db.prepare(`INSERT INTO products (id, brand_id, slug, name, display_name, theme, color, color_name, ingredients, image_url, best_moment, use_cases, pitch, sort_order)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const skus = [
    ['prod-dandelion','loveintea','dandelion','Dandelion','DANDELION TEA BAGS','Daily reset ritual','#F4A020','Dandelion Gold','["Dandelion","Ginger","Artichoke","Tangerine Peel","Hibiscus"]','/brand/products/Da.png','morning','["morning","after-meal"]','Gentle daily reset; warm, earthy, golden cup',0],
    ['prod-ginger','loveintea','ginger','Ginger','GINGER TEA BAGS','Warm morning lift','#A8B525','Ginger Zest','["Dried Ginger (53%)","Ampelopsis","Jujube","Jasmine","Cinnamon"]','/brand/products/Gi.png','morning','["morning","wfh-desk"]','Cozy warming morning ritual, spicy-sweet',1],
    ['prod-hibiscus','loveintea','hibiscus','Hibiscus','HIBISCUS TEA BAGS','Bright & refreshing','#5B8C3E','Hibiscus Garden','["Hibiscus (25%)","Ginger","Tangerine Peel","Artichoke","Jujube"]','/brand/products/Hi.png','afternoon','["afternoon","cold-brew","self-care"]','Bright ruby cup, vibrant and uplifting',2],
    ['prod-lemon-balm','loveintea','lemon-balm','Lemon Balm','LEMON BALM TEA BAGS','Calm & unwind','#8BBF5C','Lemon Mist','["Perilla","Ginger","Fennel","Lemon Balm","Jiaogulan","Peppermint"]','/brand/products/Le.png','evening','["evening","self-care","journaling"]','Unwind, light-hearted calm moment',3],
    ['prod-peppermint','loveintea','peppermint','Peppermint','PEPPERMINT TEA BAGS','Cool & after-meal ease','#5BBCD2','Peppermint Wave','["Peppermint (40%)","Artichoke","Ampelopsis","Perilla","Reishi"]','/brand/products/Pe.png','afternoon','["after-meal","afternoon","wfh-desk"]','Cool, fresh after-meal ritual',4],
    ['prod-nighty-night','loveintea','nighty-night','Nighty Night','NIGHTY NIGHT TEA BAGS','Wind-down before sleep','#3F3D99','Dreamy Indigo','["Perilla","Chamomile","Lotus Leaf","Jujube","Lemon Balm","Jiaogulan"]','/brand/products/Ni.png','evening','["bedside","sofa","journaling"]','Evening wind-down ritual, restful and quiet',5],
  ];
  for (const s of skus) productInsert.run(...s);
}
