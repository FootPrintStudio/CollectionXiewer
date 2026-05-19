import type Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import { getBetterSqlite3 } from '../lib/lazyNative'
import { loadSchema } from './migrate'

let db: Database.Database | null = null

export function getDbPath(): string {
  const configDir = join(app.getPath('home'), '.config', 'CollectionXiewer')
  mkdirSync(configDir, { recursive: true })
  return join(configDir, 'library.db')
}

export function getDb(): Database.Database {
  if (!db) {
    db = new (getBetterSqlite3())(getDbPath())
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    migrate(db)
  }
  return db
}

function tableExists(database: Database.Database, name: string): boolean {
  return !!database
    .prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?`)
    .get(name)
}

function columnExists(database: Database.Database, table: string, column: string): boolean {
  const cols = database.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]
  return cols.some((c) => c.name === column)
}

function migrateLegacyTags(database: Database.Database): void {
  if (!tableExists(database, 'tags')) return

  if (!tableExists(database, 'tag_collections') && !tableExists(database, 'tag_groups')) {
    database.exec(`
      CREATE TABLE tag_groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        label TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0
      );
    `)
  }

  if (!columnExists(database, 'tags', 'collection_id') && !columnExists(database, 'tags', 'tag_group_id')) {
    const groupTable = tableExists(database, 'tag_groups') ? 'tag_groups' : 'tag_collections'
    database.exec(
      `ALTER TABLE tags ADD COLUMN collection_id INTEGER REFERENCES ${groupTable}(id) ON DELETE SET NULL`
    )
  }

  if (columnExists(database, 'tags', 'subcategory')) {
    try {
      database.exec(`ALTER TABLE tags DROP COLUMN subcategory`)
    } catch {
      const groupTable = tableExists(database, 'tag_groups') ? 'tag_groups' : 'tag_collections'
      database.exec(`
        CREATE TABLE tags_migrated (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          slug TEXT NOT NULL UNIQUE,
          display_name TEXT NOT NULL,
          disambiguator TEXT,
          parent_id INTEGER REFERENCES tags(id) ON DELETE SET NULL,
          collection_id INTEGER REFERENCES ${groupTable}(id) ON DELETE SET NULL,
          color TEXT,
          icon TEXT,
          description_md TEXT,
          created_at TEXT NOT NULL
        );
        INSERT INTO tags_migrated (
          id, slug, display_name, disambiguator, parent_id, collection_id, color, icon, description_md, created_at
        )
        SELECT id, slug, display_name, disambiguator, parent_id, collection_id, color, icon, description_md, created_at
        FROM tags;
        DROP TABLE tags;
        ALTER TABLE tags_migrated RENAME TO tags;
        CREATE INDEX IF NOT EXISTS idx_tags_parent ON tags(parent_id);
      `)
    }
  }
}

function migrateConsistentNaming(database: Database.Database): void {
  if (tableExists(database, 'tag_collections') && !tableExists(database, 'tag_groups')) {
    database.exec(`ALTER TABLE tag_collections RENAME TO tag_groups`)
  }

  if (columnExists(database, 'tags', 'collection_id') && !columnExists(database, 'tags', 'tag_group_id')) {
    database.exec(`ALTER TABLE tags RENAME COLUMN collection_id TO tag_group_id`)
  }

  if (tableExists(database, 'logical_groups') && !tableExists(database, 'subjects')) {
    database.exec(`ALTER TABLE logical_groups RENAME TO subjects`)
  }

  if (columnExists(database, 'media_tags', 'logical_group_id') && !columnExists(database, 'media_tags', 'subject_id')) {
    database.exec(`ALTER TABLE media_tags RENAME COLUMN logical_group_id TO subject_id`)
  }

  if (tableExists(database, 'tags') && columnExists(database, 'tags', 'tag_group_id')) {
    database.exec(`CREATE INDEX IF NOT EXISTS idx_tags_tag_group ON tags(tag_group_id)`)
  }

  if (tableExists(database, 'subjects')) {
    database.exec(`CREATE INDEX IF NOT EXISTS idx_subjects_media ON subjects(media_id)`)
  }
}

function migrateTagColors(database: Database.Database): void {
  if (tableExists(database, 'tag_groups') && !columnExists(database, 'tag_groups', 'color')) {
    database.exec(`ALTER TABLE tag_groups ADD COLUMN color TEXT`)
    database.exec(`UPDATE tag_groups SET color = '#6b5b95' WHERE color IS NULL`)
  }

  if (tableExists(database, 'tags') && !columnExists(database, 'tags', 'use_custom_color')) {
    database.exec(`ALTER TABLE tags ADD COLUMN use_custom_color INTEGER NOT NULL DEFAULT 1`)
  }
}

function migrateMediaTagSuggestions(database: Database.Database): void {
  if (tableExists(database, 'media_tag_suggestions')) return
  database.exec(`
    CREATE TABLE media_tag_suggestions (
      media_id INTEGER NOT NULL REFERENCES media_items(id) ON DELETE CASCADE,
      subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      source_tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (media_id, subject_id, tag_id, source_tag_id)
    );
    CREATE INDEX IF NOT EXISTS idx_media_tag_suggestions_media ON media_tag_suggestions(media_id);
    CREATE INDEX IF NOT EXISTS idx_media_tag_suggestions_tag ON media_tag_suggestions(tag_id);
  `)
  if (tableExists(database, 'media_tags') && tableExists(database, 'tag_connections')) {
    database.exec(`
      INSERT OR IGNORE INTO media_tag_suggestions (media_id, subject_id, tag_id, source_tag_id)
      SELECT mt.media_id, mt.subject_id, tc.target_tag_id, mt.tag_id
      FROM media_tags mt
      JOIN tag_connections tc ON tc.source_tag_id = mt.tag_id AND tc.kind = 'soft'
      WHERE mt.subject_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM media_tags applied
          WHERE applied.media_id = mt.media_id
            AND applied.subject_id = mt.subject_id
            AND applied.tag_id = tc.target_tag_id
        )
    `)
  }
}

function migrateTagSortOrder(database: Database.Database): void {
  if (!tableExists(database, 'tags') || columnExists(database, 'tags', 'sort_order')) return

  database.exec(`ALTER TABLE tags ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0`)

  const rows = database
    .prepare(`SELECT id, parent_id, tag_group_id FROM tags ORDER BY display_name COLLATE NOCASE`)
    .all() as { id: number; parent_id: number | null; tag_group_id: number | null }[]

  const groups = new Map<string, number[]>()
  for (const row of rows) {
    const key = `${row.parent_id ?? 'null'}:${row.tag_group_id ?? 'null'}`
    const list = groups.get(key) ?? []
    list.push(row.id)
    groups.set(key, list)
  }

  const update = database.prepare(`UPDATE tags SET sort_order = ? WHERE id = ?`)
  const tx = database.transaction(() => {
    for (const ids of groups.values()) {
      ids.forEach((id, index) => update.run(index, id))
    }
  })
  tx()
}

function migrateTagIcons(database: Database.Database): void {
  if (tableExists(database, 'tag_groups') && !columnExists(database, 'tag_groups', 'icon')) {
    database.exec(`ALTER TABLE tag_groups ADD COLUMN icon TEXT`)
  }

  if (tableExists(database, 'tags') && !columnExists(database, 'tags', 'use_custom_icon')) {
    database.exec(`ALTER TABLE tags ADD COLUMN use_custom_icon INTEGER NOT NULL DEFAULT 0`)
  }
}

function migrateCollectionSortOrder(database: Database.Database): void {
  if (!tableExists(database, 'collections') || columnExists(database, 'collections', 'sort_order')) {
    return
  }

  database.exec(`ALTER TABLE collections ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0`)

  const rows = database
    .prepare(`SELECT id FROM collections ORDER BY name COLLATE NOCASE`)
    .all() as { id: number }[]

  const update = database.prepare(`UPDATE collections SET sort_order = ? WHERE id = ?`)
  const tx = database.transaction(() => {
    rows.forEach((row, index) => update.run(index, row.id))
  })
  tx()
}

function migrate(database: Database.Database): void {
  migrateLegacyTags(database)
  migrateConsistentNaming(database)
  database.exec(loadSchema())
  migrateConsistentNaming(database)
  migrateTagColors(database)
  migrateTagIcons(database)
  migrateTagSortOrder(database)
  migrateMediaTagSuggestions(database)
  migrateCollectionSortOrder(database)

  database.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS tags_fts USING fts5(
      display_name,
      disambiguator,
      description_md
    );
  `)

  database.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS collections_fts USING fts5(
      name,
      description_md
    );
  `)

  database.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS media_wiki_fts USING fts5(body_md);
  `)

  rebuildFts(database)
}

export function rebuildFts(database: Database.Database = getDb()): void {
  database.exec(`DELETE FROM tags_fts`)
  const tags = database.prepare(`SELECT id, display_name, disambiguator, description_md FROM tags`).all() as {
    id: number
    display_name: string
    disambiguator: string | null
    description_md: string | null
  }[]
  const ins = database.prepare(
    `INSERT INTO tags_fts(rowid, display_name, disambiguator, description_md) VALUES (?, ?, ?, ?)`
  )
  for (const t of tags) {
    ins.run(t.id, t.display_name, t.disambiguator ?? '', t.description_md ?? '')
  }

  database.exec(`DELETE FROM collections_fts`)
  const cols = database.prepare(`SELECT id, name, description_md FROM collections`).all() as {
    id: number
    name: string
    description_md: string | null
  }[]
  const insC = database.prepare(
    `INSERT INTO collections_fts(rowid, name, description_md) VALUES (?, ?, ?)`
  )
  for (const c of cols) {
    insC.run(c.id, c.name, c.description_md ?? '')
  }

  if (tableExists(database, 'media_wiki_fts')) {
    database.exec(`DELETE FROM media_wiki_fts`)
    const wikiPages = database
      .prepare(
        `SELECT entity_id, body_md FROM wiki_pages
         WHERE entity_type = 'media' AND length(trim(body_md)) > 0`
      )
      .all() as { entity_id: number; body_md: string }[]
    const insW = database.prepare(`INSERT INTO media_wiki_fts(rowid, body_md) VALUES (?, ?)`)
    for (const w of wikiPages) {
      insW.run(w.entity_id, w.body_md)
    }
  }
}

export function closeDb(): void {
  if (db) {
    db.close()
    db = null
  }
}
