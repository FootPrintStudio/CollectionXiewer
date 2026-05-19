import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { getDb, closeDb } from './db/database'
import { registerIpcHandlers, setMainWindow } from './ipc/handlers'
import { stopAllWatchers } from './services/watcher'
import { initWatchers } from './services/roots'
import { rebuildAllClosure } from './services/tags'

const isDev = !app.isPackaged
let mainWindow: BrowserWindow | null = null

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
  mainWindow.on('ready-to-show', () => mainWindow?.show())

  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
    setMainWindow(null)
  })
}

app.whenReady().then(() => {
  getDb()
  rebuildAllClosure()
  registerIpcHandlers()
  initWatchers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => {
  stopAllWatchers()
  closeDb()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
