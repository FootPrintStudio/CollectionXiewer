import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { getDb, closeDb } from './db/database'
import { registerIpcHandlers, setMainWindow } from './ipc/handlers'
import {
  initUpdater,
  scheduleStartupUpdateCheck,
  setUpdaterMainWindow
} from './services/updater'
import { installMediaProtocolHandler, registerMediaScheme } from './protocol/mediaProtocol'
import { stopAllWatchers, stopAllWatchersAsync } from './services/watcher'
import { initWatchers } from './services/roots'
import { reconcileMissingMedia } from './services/indexer'
import { drainIndexQueue } from './services/indexQueue'
import { rebuildAllClosure } from './services/tags'
import { migrateVirtualCrops } from './services/crop'
import { ensureTagClosureCurrent } from './services/appPrefs'
import { startLocalApi, stopLocalApi } from './services/localApi'

registerMediaScheme()

function logProcessError(kind: string, err: unknown): void {
  const message = err instanceof Error ? err.stack || err.message : String(err)
  console.error(`[main] ${kind}:`, message)
}

process.on('uncaughtException', (err) => {
  logProcessError('uncaughtException', err)
})

process.on('unhandledRejection', (reason) => {
  logProcessError('unhandledRejection', reason)
})

const isDev = !app.isPackaged
let mainWindow: BrowserWindow | null = null
let quitting = false

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1500,
    height: 950,
    minWidth: 1000,
    minHeight: 700,
    show: false,
    title: 'CollectionXiewer',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  setMainWindow(mainWindow)
  setUpdaterMainWindow(mainWindow)
  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
    scheduleStartupUpdateCheck()
  })

  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
    setMainWindow(null)
    setUpdaterMainWindow(null)
  })
}

app.whenReady().then(async () => {
  getDb()
  installMediaProtocolHandler()
  ensureTagClosureCurrent(rebuildAllClosure)
  registerIpcHandlers()
  startLocalApi()
  initUpdater()
  initWatchers()
  createWindow()
  // Soft-missing for files removed while the app was closed (non-blocking).
  try {
    const n = reconcileMissingMedia()
    if (n > 0) console.info(`[indexer] marked ${n} missing file(s)`)
  } catch (err) {
    console.warn('[indexer] reconcile failed:', err instanceof Error ? err.message : err)
  }
  // Bake legacy virtual crops after UI is up so startup is not blocked.
  void migrateVirtualCrops().catch((err) => {
    console.warn('[crop] migration failed:', err instanceof Error ? err.message : err)
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', (e) => {
  if (quitting) return
  e.preventDefault()
  quitting = true
  void (async () => {
    try {
      stopLocalApi()
      await drainIndexQueue()
      await stopAllWatchersAsync()
    } catch (err) {
      console.warn('[quit] drain failed:', err instanceof Error ? err.message : err)
      stopAllWatchers()
    } finally {
      closeDb()
      app.quit()
    }
  })()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
