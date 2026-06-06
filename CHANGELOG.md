# Changelog

All notable changes to CollectionXiewer are documented here.

## 1.1.0 — 2026-05-18

### Added
- Optional subject regions on preview (images and motion): draw, edit, clear, and toggle visibility
- Tag drop targets on subject regions; regions appear during tag drag even when hidden
- Editable subject names in the details panel
- Distinct colored borders per subject region (transparent interior)
- Full-resolution preview zoom for standard images (loads originals instead of downscaled previews)

## 1.0.1 — 2026-05-18

### Added
- Floating, draggable tag connection modal (no dark backdrop; opens over details panel)
- Pointer-scoped drag auto-scroll so only the sidebar under the cursor scrolls

## 1.0.0 — 2026-05-18

First stable release for Linux personal archive workflows.

### Added
- Toast notifications for drag-and-drop, folder, and board save errors
- React error boundary and startup failure screen
- Gallery load-more pagination (500 items per page)
- Settings: backup library database and open data folder
- Board redo (toolbar + Ctrl+Shift+Z / Ctrl+Y)
- Persistent ffmpeg missing banner in the gallery area
- CI workflow (typecheck + tests) and release gate
- App icon for Linux AppImage

### Changed
- Startup skips full tag-closure and FTS rebuilds when already in sync
- Duplicate watch-folder adds show a clear error instead of failing silently
- Board save failures surface in the toolbar with retry

### Fixed
- Vault performance tier for low-core CPUs and reduced-motion preference (from 0.2.5)
- Connection modal stays open for batch linking (from 0.2.5)

## 0.2.5 — 2026-05-18

- Vault atmosphere FX lite tier on reduced motion or ≤4 CPU cores
- Connection modal batch UX (Done instead of Cancel)
- Tag delete suggestion refresh batched in one transaction
- Search debounce increased to 450ms

## 0.2.4 — 2026-05-18

- Vault theme
- Tag delete from library (right-click)
- Drag tags onto search bar to append filters

## 0.2.3 and earlier

See [GitHub Releases](https://github.com/FootPrintStudio/CollectionXiewer/releases).
