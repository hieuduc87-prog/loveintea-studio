# Marketing Studio — System Architecture
## From single-brand tool → multi-brand Marketing Operating System

---

## 1. The Problem with Current Architecture

Current state: **12 disconnected tabs**, each doing one thing.
- Brand DNA is hardcoded in `brand-dna.ts` — can't change at runtime, can't add a second brand
- Variables (Segments, USPs, RTBs) live in code, not in DB — no tracking, no learning
- Content Plan import creates `posts` but doesn't link back to the plan structure
- No performance loop: published → metrics → learn → improve next plan
- No concept of "campaign" or "wave" tying content together
- Settings are flat key/value — no hierarchy

**What a 30-year marketer needs:**
A closed-loop system: `Strategy → Plan → Create → Publish → Measure → Learn → Strategy`

---

## 2. Entity Model — 5 Scientific Layers

```
┌─────────────────────────────────────────────────────┐
│  LAYER 1: ORGANIZATION                              │
│  └── brands[]                                       │
│       └── brand_settings                            │
│       └── brand_members (users with roles)          │
├─────────────────────────────────────────────────────┤
│  LAYER 2: STRATEGY (mostly static, reviewed qtrly)  │
│  ├── brand_dna (voice, colors, type, compliance)    │
│  ├── products[] (SKUs with ingredients, imagery)    │
│  ├── audiences[] (segments, age, tension, lead_skus)│
│  ├── variables[] — unified table, typed:            │
│  │   ├── type=usp      (Ubag, Uwhole, ...)         │
│  │   ├── type=rtb      (R7xM2, ...)                │
│  │   ├── type=narrative (N-HR, N-POV, ...)          │
│  │   ├── type=context   (C-EveSofa, ...)            │
│  │   ├── type=cta       (Save this, ...)            │
│  │   └── type=format    (E-Still-L, ...)            │
│  ├── channels[] (FB page, IG account, blog)         │
│  └── knowledge_docs[] (brand voice, comm direction) │
├─────────────────────────────────────────────────────┤
│  LAYER 3: PLANNING (monthly/campaign cycle)         │
│  ├── campaigns[] (name, dates, objectives)          │
│  ├── content_plans[] (month, wave structure)         │
│  │   └── plan_items[] (date, SKU, hook, copy, vis)  │
│  └── stories_rotation (daily themes, highlights)    │
├─────────────────────────────────────────────────────┤
│  LAYER 4: EXECUTION (daily operations)              │
│  ├── posts[] (caption, image, variables used)       │
│  │   └── plan_item_id → link to plan_items          │
│  ├── assets[] (images, files in library)            │
│  ├── image_jobs[] (AI generation queue)             │
│  ├── blog_posts[]                                   │
│  └── publishing_events[] (per-channel publish logs) │
├─────────────────────────────────────────────────────┤
│  LAYER 5: INTELLIGENCE (feedback loop)              │
│  ├── post_metrics[] (reach, engaged, reactions...)  │
│  │   └── fetched per rolling window (3/7/14/30d)    │
│  ├── variable_scores[] (which USP×Segment×SKU wins) │
│  ├── insights[] (derived learnings, auto + manual)  │
│  └── inbox_messages[] (community signals)           │
└─────────────────────────────────────────────────────┘
```

---

## 3. The Closed Loop — How Layers Connect

```
          ┌──── STRATEGY ────┐
          │ Brand DNA         │
          │ Products          │◄──── Updated by INSIGHTS
          │ Variables         │
          │ Knowledge Docs    │
          └───────┬───────────┘
                  ▼
          ┌──── PLANNING ────┐
          │ Campaigns         │
          │ Content Plans     │◄──── Informed by METRICS
          │ Plan Items        │      (which variables won?)
          └───────┬───────────┘
                  ▼
          ┌──── EXECUTION ───┐
          │ Posts (generated) │
          │ Assets (images)   │
          │ Blog posts        │
          └───────┬───────────┘
                  ▼
          ┌──── PUBLISH ─────┐
          │ Scheduled         │
          │ Posted to FB/IG   │
          │ Publishing events │
          └───────┬───────────┘
                  ▼
          ┌──── INTELLIGENCE ┐
          │ Post metrics      │
          │ Variable scores   │──── feeds back to STRATEGY
          │ Derived insights  │
          └───────────────────┘
```

---

## 4. New DB Schema (multi-brand, layered)

### Layer 1 — Organization
```sql
brands (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,          -- "LoveinTea"
  slug        TEXT UNIQUE NOT NULL,   -- "loveintea"
  logo_url    TEXT,
  domain      TEXT,                   -- "loveintea.com"
  created_at  TEXT DEFAULT (datetime('now'))
);

brand_settings (
  id          TEXT PRIMARY KEY,
  brand_id    TEXT REFERENCES brands(id) ON DELETE CASCADE,
  key         TEXT NOT NULL,
  value       TEXT NOT NULL DEFAULT '',
  updated_at  TEXT DEFAULT (datetime('now')),
  UNIQUE(brand_id, key)
);
```

### Layer 2 — Strategy
```sql
brand_dna (
  id              TEXT PRIMARY KEY,
  brand_id        TEXT REFERENCES brands(id) ON DELETE CASCADE,
  tagline         TEXT,
  archetype       TEXT,
  through_line    TEXT,
  colors_json     TEXT,        -- {"heritageGreen":"#1A5632",...}
  typography_json TEXT,        -- {"display":"Sorean","body":"Lato"}
  voice_traits    TEXT,        -- JSON array
  compliance_json TEXT,        -- {"neverSay":[],"alwaysSay":[]}
  updated_at      TEXT DEFAULT (datetime('now')),
  UNIQUE(brand_id)             -- one DNA per brand
);

products (
  id              TEXT PRIMARY KEY,
  brand_id        TEXT REFERENCES brands(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  display_name    TEXT,
  theme           TEXT,
  color           TEXT,
  color_name      TEXT,
  ingredients     TEXT,        -- JSON array
  image_url       TEXT,
  best_moment     TEXT,
  use_cases       TEXT,        -- JSON array
  pitch           TEXT,
  sort_order      INTEGER DEFAULT 0,
  created_at      TEXT DEFAULT (datetime('now'))
);

audiences (
  id              TEXT PRIMARY KEY,
  brand_id        TEXT REFERENCES brands(id) ON DELETE CASCADE,
  code            TEXT NOT NULL,     -- "S1", "S2"
  name            TEXT NOT NULL,
  age_range       TEXT,
  tension         TEXT,
  lead_product_ids TEXT,             -- JSON array of product ids
  sort_order      INTEGER DEFAULT 0,
  UNIQUE(brand_id, code)
);

variables (
  id              TEXT PRIMARY KEY,
  brand_id        TEXT REFERENCES brands(id) ON DELETE CASCADE,
  type            TEXT NOT NULL,     -- usp|rtb|narrative|context|cta|format
  code            TEXT NOT NULL,     -- "Uwhole", "R7xM2", etc.
  label           TEXT NOT NULL,
  data_json       TEXT,              -- type-specific payload
  product_ids     TEXT DEFAULT '[]', -- JSON array — which products this applies to (empty = all)
  audience_ids    TEXT DEFAULT '[]', -- JSON array — best for which segments
  sort_order      INTEGER DEFAULT 0,
  UNIQUE(brand_id, type, code)
);

channels (
  id              TEXT PRIMARY KEY,
  brand_id        TEXT REFERENCES brands(id) ON DELETE CASCADE,
  platform        TEXT NOT NULL,     -- facebook|instagram|blog|tiktok
  name            TEXT,              -- "LoveinTea Official"
  credentials     TEXT,              -- JSON (tokens, page IDs — encrypted in prod)
  status          TEXT DEFAULT 'active',
  created_at      TEXT DEFAULT (datetime('now'))
);

knowledge_docs (
  id              TEXT PRIMARY KEY,
  brand_id        TEXT REFERENCES brands(id) ON DELETE CASCADE,
  type            TEXT NOT NULL,     -- brand_voice|comm_direction|guideline|research
  title           TEXT NOT NULL,
  content         TEXT,
  file_url        TEXT,
  uploaded_at     TEXT DEFAULT (datetime('now'))
);
```

### Layer 3 — Planning
```sql
campaigns (
  id              TEXT PRIMARY KEY,
  brand_id        TEXT REFERENCES brands(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  objective       TEXT,
  start_date      TEXT,
  end_date        TEXT,
  status          TEXT DEFAULT 'planning',  -- planning|active|completed
  created_at      TEXT DEFAULT (datetime('now'))
);

content_plans (
  id              TEXT PRIMARY KEY,
  brand_id        TEXT REFERENCES brands(id) ON DELETE CASCADE,
  campaign_id     TEXT REFERENCES campaigns(id),
  title           TEXT NOT NULL,       -- "Month 1 (Jun 8 – Jul 4)"
  through_line    TEXT,
  cadence         TEXT,                -- "5 feed/wk + daily Stories"
  wave_structure  TEXT,                -- JSON: ["W1 Explore","W2 Exploit","W3 Scale"]
  stories_json    TEXT,                -- daily rotation + highlights
  summary_json    TEXT,                -- balance check data
  source_file     TEXT,                -- original xlsx filename
  created_at      TEXT DEFAULT (datetime('now'))
);

plan_items (
  id              TEXT PRIMARY KEY,
  plan_id         TEXT REFERENCES content_plans(id) ON DELETE CASCADE,
  brand_id        TEXT REFERENCES brands(id),
  date            TEXT,
  day_of_week     TEXT,
  wave            TEXT,
  surface         TEXT,                -- "Reel · 9:16"
  purpose         TEXT,                -- "Educate"
  pillar          TEXT,                -- "Product"
  product_id      TEXT REFERENCES products(id),
  audience_id     TEXT,                -- segment code
  rtb_code        TEXT,
  usp_code        TEXT,
  context         TEXT,
  hook            TEXT,
  copy_direction  TEXT,
  visual_direction TEXT,
  hashtags        TEXT,
  repurpose       TEXT,
  tree_id         TEXT,                -- "LIT-M1W1-01"
  win_band        TEXT,
  sort_order      INTEGER DEFAULT 0
);
```

### Layer 4 — Execution (evolves from current `posts`)
```sql
-- posts table keeps existing columns, ADD:
ALTER TABLE posts ADD COLUMN brand_id TEXT DEFAULT 'loveintea';
ALTER TABLE posts ADD COLUMN plan_item_id TEXT;   -- links to plan_items
ALTER TABLE posts ADD COLUMN campaign_id TEXT;
ALTER TABLE posts ADD COLUMN format_id TEXT;
ALTER TABLE posts ADD COLUMN variables_json TEXT;  -- snapshot of all variables used

-- image_library ADD:
ALTER TABLE image_library ADD COLUMN brand_id TEXT DEFAULT 'loveintea';

-- blog_posts ADD:
ALTER TABLE blog_posts ADD COLUMN brand_id TEXT DEFAULT 'loveintea';
ALTER TABLE blog_posts ADD COLUMN campaign_id TEXT;
```

### Layer 5 — Intelligence
```sql
post_metrics (
  id              TEXT PRIMARY KEY,
  post_id         TEXT REFERENCES posts(id),
  brand_id        TEXT REFERENCES brands(id),
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
  profile_visits  INTEGER DEFAULT 0,
  link_clicks     INTEGER DEFAULT 0
);

variable_scores (
  id              TEXT PRIMARY KEY,
  brand_id        TEXT REFERENCES brands(id),
  variable_id     TEXT REFERENCES variables(id),
  product_id      TEXT,
  metric          TEXT NOT NULL,      -- reach|engaged|saves|sends
  avg_score       REAL DEFAULT 0,
  sample_size     INTEGER DEFAULT 0,
  period          TEXT,               -- "2026-06" or "rolling_30d"
  updated_at      TEXT DEFAULT (datetime('now')),
  UNIQUE(brand_id, variable_id, product_id, metric, period)
);

insights (
  id              TEXT PRIMARY KEY,
  brand_id        TEXT REFERENCES brands(id),
  type            TEXT NOT NULL,      -- variable_win|audience_shift|content_fatigue|format_trend
  title           TEXT NOT NULL,
  description     TEXT,
  evidence_json   TEXT,               -- supporting data
  priority        INTEGER DEFAULT 5,  -- 1=urgent, 10=fyi
  status          TEXT DEFAULT 'new', -- new|acknowledged|applied
  created_at      TEXT DEFAULT (datetime('now'))
);
```

---

## 5. UI/UX — Workflow-Based Navigation

**Current (tool-based):** 12 tabs in a flat list.
**New (workflow-based):** 6 groups following the marketing lifecycle.

```
┌──────────────────────────────────────────────────────┐
│  [Brand Switcher ▼ LoveinTea]                        │
├──────────────────────────────────────────────────────┤
│                                                      │
│  📋 STRATEGY                                        │
│    Brand DNA          — identity, voice, colors      │
│    Products           — SKUs, ingredients, imagery   │
│    Audiences          — segments, tensions           │
│    Variables          — USPs, RTBs, narratives, CTA  │
│    Knowledge          — brand voice, guidelines      │
│                                                      │
│  📅 PLAN                                            │
│    Campaigns          — objectives, date ranges      │
│    Content Plans      — monthly calendars (import)   │
│    Post Calendar      — drag-drop month view         │
│                                                      │
│  ✨ CREATE                                           │
│    Content Workshop   — AI caption + image gen       │
│    Image Studio       — custom image generation      │
│    Blog Factory       — blog content gen             │
│                                                      │
│  📡 PUBLISH                                         │
│    Schedule & Rules   — time slots, auto-schedule    │
│    Queue              — all posts by status          │
│    Channels           — FB/IG setup & tokens         │
│                                                      │
│  📊 MEASURE                                         │
│    Dashboard          — rolling window overview      │
│    Per-Post Report    — individual post metrics      │
│    Variable Scorecard — which combos win             │
│    Insights           — learnings + next actions     │
│                                                      │
│  📂 LIBRARY                                         │
│    Images             — all assets, upload           │
│    Inbox              — comments & messages          │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

## 6. Key UX Principles

1. **One source of truth per entity** — products, variables, audiences in DB, not code.
   Brand DNA page = editable form, not a read-only display.

2. **Everything links** — a post knows which plan_item it came from, which variables
   it used, what campaign it belongs to. Click any metric to trace back.

3. **Variable scorecard** — the killer feature. Every published post tags its variables
   (USP, segment, context, narrative). Metrics feed back. Dashboard shows:
   "Uwhole + S2 + C-Macro → avg reach 12.4K (n=5)"
   "Uritual + S1 + C-EveSofa → avg reach 8.1K (n=3)"
   Marketer sees which combinations win and doubles down.

4. **Content Plan → Posts → Metrics** chain is visible.
   Open a plan item → see the generated post → see its metrics → see insights.

5. **Brand switcher** — top of sidebar. All queries scoped by brand_id.
   New brand = new set of products, variables, plans. Same UI.

6. **Progressive disclosure** — Strategy is collapsed for daily operators.
   Plan + Create + Publish are the daily workspace. Measure is the weekly review.

---

## 7. Migration Path

Phase 1 (this session):
- Add multi-brand tables
- Migrate brand-dna.ts data into DB (brand_dna, products, audiences, variables)
- Add brand_id to existing tables with default 'loveintea'
- Restructure navigation

Phase 2 (next session):
- Content plan ↔ post linking
- Variable scorecard + auto-scoring
- Editable Brand DNA form
- Brand switcher

Phase 3 (future):
- Multi-user roles
- Template library across brands
- Competitive benchmarking
- AI-powered insights generation
