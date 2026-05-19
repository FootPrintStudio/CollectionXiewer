# CollectionXiewer

Local-first media browser and viewer for art/reference archives on Linux, built with Electron, React, and SQLite.

## Features

- Watch-folder indexing (reference library; files stay on disk)
- Rich tagging: hard/soft connections, logical groups, disambiguation, hierarchy search
- Collections with principal tags
- Grid, column masonry, and horizontal row-normalized masonry galleries
- Large previewer with non-destructive free-form crop and export
- Visual query builder and saved searches
- CodeMirror 6 wiki markdown with tag/collection/external links
- Image (incl. TGA), motion (GIF/WebP/APNG), and video file-level tags

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run dist   # Linux AppImage
```

## Data

SQLite database: `~/.config/CollectionXiewer/library.db`
