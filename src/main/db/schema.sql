PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS watch_roots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT NOT NULL UNIQUE,
  enabled INTEGER NOT NULL DEFAULT 1,
  last_scan_at TEXT
);

CREATE TABLE IF NOT EXISTS media_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  root_id INTEGER NOT NULL REFERENCES watch_roots(id) ON DELETE CASCADE,
  relative_path TEXT NOT NULL,
  mime TEXT,
  kind TEXT NOT NULL DEFAULT 'unknown',
  width INTEGER,
  height INTEGER,
  duration_ms INTEGER,
  mtime INTEGER NOT NULL,
  indexed_at TEXT NOT NULL,
  missing INTEGER NOT NULL DEFAULT 0,
  UNIQUE(root_id, relative_path)
);

CREATE TABLE IF NOT EXISTS media_crop (
  media_id INTEGER PRIMARY KEY REFERENCES media_items(id) ON DELETE CASCADE,
  x REAL NOT NULL,
  y REAL NOT NULL,
  w REAL NOT NULL,
  h REAL NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tag_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  color TEXT,
  icon TEXT
);

CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  disambiguator TEXT,
  parent_id INTEGER REFERENCES tags(id) ON DELETE SET NULL,
  tag_group_id INTEGER REFERENCES tag_groups(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  color TEXT,
  use_custom_color INTEGER NOT NULL DEFAULT 0,
  icon TEXT,
  use_custom_icon INTEGER NOT NULL DEFAULT 0,
  description_md TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tag_external_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  url TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tag_connections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  target_tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK(kind IN ('hard', 'soft')),
  UNIQUE(source_tag_id, target_tag_id, kind)
);

CREATE TABLE IF NOT EXISTS tag_closure (
  ancestor_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  descendant_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  depth INTEGER NOT NULL,
  PRIMARY KEY (ancestor_id, descendant_id)
);

CREATE TABLE IF NOT EXISTS subjects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  media_id INTEGER NOT NULL REFERENCES media_items(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- Same tag may appear on one media item once per subject (e.g. shared trait on different characters).
CREATE TABLE IF NOT EXISTS media_tags (
  media_id INTEGER NOT NULL REFERENCES media_items(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  subject_id INTEGER REFERENCES subjects(id) ON DELETE CASCADE,
  PRIMARY KEY (media_id, tag_id, subject_id)
);

-- Soft-linked tags suggested per subject (derived from applied tags + tag_connections).
CREATE TABLE IF NOT EXISTS media_tag_suggestions (
  media_id INTEGER NOT NULL REFERENCES media_items(id) ON DELETE CASCADE,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  source_tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (media_id, subject_id, tag_id, source_tag_id)
);

CREATE TABLE IF NOT EXISTS collections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description_md TEXT,
  created_at TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS collection_members (
  collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  media_id INTEGER NOT NULL REFERENCES media_items(id) ON DELETE CASCADE,
  sort_key TEXT NOT NULL,
  PRIMARY KEY (collection_id, media_id)
);

CREATE TABLE IF NOT EXISTS collection_principal_tags (
  collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (collection_id, tag_id)
);

CREATE TABLE IF NOT EXISTS wiki_pages (
  entity_type TEXT NOT NULL CHECK(entity_type IN ('tag', 'media', 'collection')),
  entity_id INTEGER NOT NULL,
  body_md TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (entity_type, entity_id)
);

CREATE TABLE IF NOT EXISTS saved_searches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  query_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS media_poster (
  media_id INTEGER PRIMARY KEY REFERENCES media_items(id) ON DELETE CASCADE,
  time_ms REAL NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS identifiers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  label TEXT NOT NULL,
  icon TEXT NOT NULL,
  color TEXT NOT NULL,
  query_text TEXT NOT NULL,
  query_ast TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_media_root ON media_items(root_id);
CREATE INDEX IF NOT EXISTS idx_media_tags_tag ON media_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_media_tags_media ON media_tags(media_id);
CREATE INDEX IF NOT EXISTS idx_media_tag_suggestions_media ON media_tag_suggestions(media_id);
CREATE INDEX IF NOT EXISTS idx_media_tag_suggestions_tag ON media_tag_suggestions(tag_id);
CREATE INDEX IF NOT EXISTS idx_tags_parent ON tags(parent_id);
CREATE INDEX IF NOT EXISTS idx_collection_members_media ON collection_members(media_id);
CREATE INDEX IF NOT EXISTS idx_subjects_media ON subjects(media_id);
