import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { IPC } from '../shared/ipc'

const ALLOWED_CHANNELS = new Set([...Object.values(IPC), 'wizard:install:line'])

contextBridge.exposeInMainWorld('ipc', {
  invoke(channel: string, ...args: unknown[]): Promise<unknown> {
    if (!ALLOWED_CHANNELS.has(channel as any)) throw new Error(`IPC channel not allowed: ${channel}`)
    return ipcRenderer.invoke(channel, ...args)
  },
  on(channel: string, listener: (...args: unknown[]) => void): () => void {
    if (!ALLOWED_CHANNELS.has(channel as any)) throw new Error(`IPC channel not allowed: ${channel}`)
    const wrapped = (_event: unknown, ...args: unknown[]) => listener(...args)
    ipcRenderer.on(channel, wrapped)
    return () => ipcRenderer.removeListener(channel, wrapped)
  },
  getPathForFile(file: File): string {
    return webUtils.getPathForFile(file)
  },
})
