declare global {
  interface Window {
    ipc: {
      invoke(channel: string, ...args: unknown[]): Promise<unknown>;
      on(channel: string, listener: (...args: unknown[]) => void): () => void;
      getPathForFile(file: File): string;
    };
  }
}

export let lastIpcError: Error | null = null;
export function clearIpcError() {
  lastIpcError = null;
}

export function ipcInvoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  return window.ipc.invoke(channel, ...args).catch((err: Error) => {
    lastIpcError = err;
    console.error(`IPC ${channel} failed:`, err);
    throw err;
  }) as Promise<T>;
}

export function onIpcEvent<T>(
  channel: string,
  cb: (data: T) => void,
): () => void {
  return window.ipc.on(channel, cb as any);
}
