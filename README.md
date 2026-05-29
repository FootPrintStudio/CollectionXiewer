# CollectionXiewer

Local-first media browser and viewer for art/reference archives on Linux, built with Electron, React, and SQLite.

## Features

- Watch-folder indexing (reference library; files stay on disk)
- Rich tagging: hard/soft connections, logical groups, disambiguation, hierarchy search
- Tag delete from library (right-click) with impact confirmation
- Drag tags from the library onto the search bar to append `tag:slug` filters
- Collections with principal tags and manual ordering in the library panel
- **Design boards** — free-form canvas with media refs, notes, grouping, undo/redo, PNG export
- **Identifiers** — coloured Unicode icons on gallery thumbs driven by saved search queries
- Grid, column masonry, and horizontal row-normalized masonry galleries (paginated load-more)
- Large previewer with non-destructive free-form crop and export
- Advanced text search with saved searches
- CodeMirror 6 wiki markdown with tag/collection/external links
- Image (incl. BMP, TGA, and HEIC), motion (GIF/WebP/APNG), and video file-level tags
- Vault theme with performance-aware atmosphere FX
- In-app updates via GitHub Releases (Linux AppImage)

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

## Boards

Boards are JSON documents (`.cxboard.json`) stored in a folder you choose under **Boards Library**. Use the board toolbar to place gallery selections, align items, group, and export PNG snapshots. Undo/redo up to five steps.

## Identifiers

Configure under **Settings → Identifiers**. Each identifier uses a search query; matching media show a coloured icon on gallery thumbnails (toggle with **Settings → Identifier icons**).

## Development

```bash
npm install
npm run dev
```

Video thumbnails and metadata use **ffmpeg** / **ffprobe** on your `PATH` (override with `FFMPEG_PATH` / `FFPROBE_PATH`). A banner appears when they are missing.

```bash
npm run typecheck
npm test
```

## Build

```bash
npm run build
npm run dist   # Linux AppImage
```

Output: `dist/CollectionXiewer-<version>.AppImage`

## Updates

Installed builds check GitHub Releases for updates (Settings → **Check for updates…**, or automatically shortly after startup). Downloads require your confirmation; use **Restart to update** when the new AppImage is ready.

Updates only work in the packaged AppImage, not in `npm run dev`. The AppImage file must be writable (e.g. in your home folder); if auto-replace fails, use **GitHub releases** in the dialog to download manually.

### Releasing a new version (maintainers)

1. Bump `"version"` in `package.json` (must match the git tag without the `v` prefix).
2. Update `CHANGELOG.md`.
3. Commit and push, then create and push a tag: `git tag v1.0.0 && git push origin v1.0.0`
4. GitHub Actions runs typecheck/tests, builds the AppImage, and publishes to [Releases](https://github.com/FootPrintStudio/CollectionXiewer/releases) with `latest-linux.yml` for the in-app updater.

Local publish (optional): `export GH_TOKEN=<token-with-repo-scope>` then `npm run dist:publish`.

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

- SQLite database: `~/.config/CollectionXiewer/library.db`
- Backup: **Settings → Backup library now…** or **Open data folder**
- Boards folder: chosen in Boards Library (`.cxboard.json` files)

See [CHANGELOG.md](CHANGELOG.md) for version history.
