import { autoUpdater } from 'electron-updater'
import { BrowserWindow } from 'electron'

export function initUpdater(win: BrowserWindow): void {
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => {
    win.webContents.send('update:status', 'checking')
  })

  autoUpdater.on('update-available', (info) => {
    win.webContents.send('update:available', {
      version: info.version,
      releaseNotes: info.releaseNotes ?? '',
    })
  })

  autoUpdater.on('update-not-available', () => {
    win.webContents.send('update:status', 'up-to-date')
  })

  autoUpdater.on('error', (err) => {
    win.webContents.send('update:error', err.message)
  })

  autoUpdater.on('download-progress', (progress) => {
    win.webContents.send('update:progress', progress.percent)
  })

  autoUpdater.on('update-downloaded', () => {
    win.webContents.send('update:downloaded')
  })

  setTimeout(() => autoUpdater.checkForUpdates(), 3000)
}

export function downloadUpdate(): void {
  autoUpdater.downloadUpdate()
}

export function quitAndInstall(): void {
  autoUpdater.quitAndInstall()
}
