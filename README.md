# CollectionXiewer

Local-first media browser and viewer for art/reference archives on Linux, built with Electron, React, and SQLite.

## Features

- Watch-folder indexing (reference library; files stay on disk)
- Rich tagging: hard/soft connections, logical groups, disambiguation, hierarchy search
- Collections with principal tags and manual ordering in the library panel
- Grid, column masonry, and horizontal row-normalized masonry galleries
- Large previewer with non-destructive free-form crop and export
- Advanced text search with saved searches
- CodeMirror 6 wiki markdown with tag/collection/external links
- Image (incl. BMP, TGA, and HEIC), motion (GIF/WebP/APNG), and video file-level tags

## Search syntax

Queries are typed in the search bar (parsed by `src/shared/searchParser.ts`, executed by `src/main/services/mediaQuery.ts`). Examples:

- `tag:slug` — media with tag (descendants included)
- `-tag:slug` — without tag
- `tag:a tag:b` — both tags
- `tag:a@subject tag:b@subject` — same subject group
- `suggested:slug` — soft-linked suggestion
- `collection:"Name"` — collection membership
- `principal:slug` — principal tag on a collection
- `folder:"/path/to/root"` — under a watch folder
- `name:pattern` — path/filename globs (`*`, `?`)
- `wiki:"phrase"` / `wiki:empty` — media wiki full-text or empty wiki
- `untagged:` — no tags on media
- `kind:image` — media kind (`image`, `motion`, `video`)
- `AND`, `OR`, `NOT`, `( )` — boolean logic

Saved searches store the current query for one-click reload.

## Development

```bash
npm install
npm run dev
```

Video thumbnails and metadata use **ffmpeg** / **ffprobe** on your `PATH` (override with `FFMPEG_PATH` / `FFPROBE_PATH`).

## Build

```bash
npm run build
npm run dist   # Linux AppImage
```

Output: `dist/CollectionXiewer-<version>.AppImage`

## Install (AppImage)

```bash
chmod +x CollectionXiewer-*.AppImage
./CollectionXiewer-*.AppImage
```

On Ubuntu 24.04+ without FUSE, either install `libfuse2t64` or run:

```bash
./CollectionXiewer-*.AppImage --appimage-extract-and-run
```

## Data

SQLite database: `~/.config/CollectionXiewer/library.db`
