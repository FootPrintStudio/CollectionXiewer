import { useCallback, useEffect, useState } from 'react'
import { TagDndProvider } from './dnd/TagDndProvider'
import { LibraryPanel } from './components/LibraryPanel'
import { DetailsPanel } from './components/DetailsPanel'
import { SearchBar } from './components/SearchBar'
import { GalleryView } from './views/Gallery/GalleryView'
import { MediaPreviewer } from './views/Previewer/MediaPreviewer'
import { BoardWithGalleryView } from './views/Board/BoardWithGalleryView'
import { useAppStore } from './store/appStore'
import { PanelResizeHandle } from './ui/PanelResizeHandle'
import {
  applyPanelWidthCss,
  clampDetailsPanelWidth,
  clampLibraryPanelWidth,
  loadDetailsPanelWidth,
  loadLibraryPanelWidth,
  saveDetailsPanelWidth,
  saveLibraryPanelWidth
} from './lib/panelLayout'
import { GalleryToolbarControls } from './components/GalleryToolbarControls'
import { BulkTagBar } from './components/BulkTagBar'
import { SlideshowOverlay } from './components/SlideshowOverlay'
import { SettingsMenu } from './components/SettingsMenu'
import { initGrainTexture } from './lib/initGrainTexture'

export function App() {
  const init = useAppStore((s) => s.init)
  const galleryMode = useAppStore((s) => s.galleryMode)
  const setGalleryMode = useAppStore((s) => s.setGalleryMode)
  const gridSize = useAppStore((s) => s.gridSize)
  const setGridSize = useAppStore((s) => s.setGridSize)
  const refreshMedia = useAppStore((s) => s.refreshMedia)
  const searchAst = useAppStore((s) => s.searchAst)
  const searchQueryText = useAppStore((s) => s.searchQueryText)
  const selectedCollectionId = useAppStore((s) => s.selectedCollectionId)
  const mainView = useAppStore((s) => s.mainView)

  const [libraryPanelWidth, setLibraryPanelWidth] = useState(loadLibraryPanelWidth)
  const [detailsPanelWidth, setDetailsPanelWidth] = useState(loadDetailsPanelWidth)

  useEffect(() => {
    applyPanelWidthCss(libraryPanelWidth, detailsPanelWidth)
  }, [libraryPanelWidth, detailsPanelWidth])

  const resizeLibrary = useCallback((delta: number) => {
    setLibraryPanelWidth((w) => clampLibraryPanelWidth(w + delta))
  }, [])

  const resizeDetails = useCallback((delta: number) => {
    setDetailsPanelWidth((w) => clampDetailsPanelWidth(w + delta))
  }, [])

  useEffect(() => {
    void init()
    initGrainTexture()
  }, [init])

  useEffect(() => {
    void refreshMedia()
  }, [searchAst, searchQueryText, selectedCollectionId, refreshMedia])

  return (
    <TagDndProvider>
      <SlideshowOverlay />
      <div className="app-shell">
      <div
        className="panel-column panel-column--library"
        style={{ width: libraryPanelWidth }}
      >
        <LibraryPanel />
        <PanelResizeHandle
          growDirection="right"
          ariaLabel="Resize library panel"
          onResize={resizeLibrary}
          onResizeEnd={() =>
            setLibraryPanelWidth((w) => {
              saveLibraryPanelWidth(w)
              return w
            })
          }
        />
      </div>
      <main className="main-column">
        <div className="gallery-toolbar">
          <div className="gallery-toolbar__row gallery-toolbar__row--search">
            <SearchBar />
          </div>
          <div className="gallery-toolbar__row gallery-toolbar__row--gallery">
            <GalleryToolbarControls />
            <span className="gallery-toolbar__spacer" aria-hidden />
            <div className="gallery-toolbar__actions">
              <SettingsMenu />
              <button type="button" onClick={() => void refreshMedia()}>
                Refresh
              </button>
            </div>
          </div>
        </div>
        <div className="content-area">
          <BulkTagBar />
          {mainView === 'gallery' && <GalleryView />}
          {mainView === 'preview' && <MediaPreviewer />}
          {mainView === 'board' && <BoardWithGalleryView />}
        </div>
      </main>
      <div className="panel-column panel-column--details" style={{ width: detailsPanelWidth }}>
        <PanelResizeHandle
          growDirection="left"
          ariaLabel="Resize details panel"
          onResize={resizeDetails}
          onResizeEnd={() =>
            setDetailsPanelWidth((w) => {
              saveDetailsPanelWidth(w)
              return w
            })
          }
        />
        <DetailsPanel />
      </div>
      </div>
    </TagDndProvider>
  )
}
