import { app } from 'electron'
import { autoUpdater } from 'electron-updater'
import type { BrowserWindow } from 'electron'
import type { UpdaterStatus } from '../../shared/updaterTypes'

let mainWindow: BrowserWindow | null = null
let status: UpdaterStatus = {
  phase: 'idle',
  currentVersion: app.getVersion()
}

function broadcast(): void {
  mainWindow?.webContents.send('updater:status', status)
}

function setStatus(patch: Partial<UpdaterStatus>): void {
  status = { ...status, ...patch, currentVersion: app.getVersion() }
  broadcast()
}

export function setUpdaterMainWindow(win: BrowserWindow | null): void {
  mainWindow = win
}

export function getUpdaterStatus(): UpdaterStatus {
  return { ...status }
}

export function initUpdater(): void {
  status = { phase: 'idle', currentVersion: app.getVersion() }

  if (!app.isPackaged) {
    setStatus({
      phase: 'unavailable',
      message: 'Updates are only available in the installed app.'
    })
    return
  }

  autoUpdater.autoDownload = false
  autoUpdater.disableWebInstaller = true

  autoUpdater.on('checking-for-update', () => {
    setStatus({ phase: 'checking', message: undefined })
  })

  autoUpdater.on('update-available', (info) => {
    setStatus({
      phase: 'available',
      version: info.version,
      message: undefined,
      percent: undefined
    })
  })

  autoUpdater.on('update-not-available', () => {
    setStatus({ phase: 'not-available', message: undefined, version: undefined })
  })

  autoUpdater.on('download-progress', (progress) => {
    setStatus({
      phase: 'downloading',
      percent: progress.percent,
      message: undefined
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    setStatus({
      phase: 'downloaded',
      version: info.version,
      percent: 100,
      message: undefined
    })
  })

  autoUpdater.on('error', (err) => {
    setStatus({
      phase: 'error',
      message: err.message || String(err)
    })
  })
}

export async function checkForUpdates(): Promise<UpdaterStatus> {
  if (!app.isPackaged) {
    setStatus({
      phase: 'unavailable',
      message: 'Updates are only available in the installed app.'
    })
    return getUpdaterStatus()
  }

  try {
    await autoUpdater.checkForUpdates()
  } catch (err) {
    setStatus({
      phase: 'error',
      message: err instanceof Error ? err.message : String(err)
    })
  }
  return getUpdaterStatus()
}

export async function downloadUpdate(): Promise<UpdaterStatus> {
  if (!app.isPackaged) {
    return getUpdaterStatus()
  }
  try {
    setStatus({ phase: 'downloading', percent: 0 })
    await autoUpdater.downloadUpdate()
  } catch (err) {
    setStatus({
      phase: 'error',
      message: err instanceof Error ? err.message : String(err)
    })
  }
  return getUpdaterStatus()
}

export function quitAndInstall(): void {
  if (!app.isPackaged) return
  autoUpdater.quitAndInstall(false, true)
}

export function scheduleStartupUpdateCheck(delayMs = 8000): void {
  if (!app.isPackaged) return
  setTimeout(() => {
    void checkForUpdates()
  }, delayMs)
}
