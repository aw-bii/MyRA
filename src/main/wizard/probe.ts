import { AdapterManager } from '../adapters/manager'

export async function probeBackend(id: string): Promise<{ available: boolean; authenticated: boolean }> {
  const adapter = AdapterManager.get(id)
  if (!adapter) return { available: false, authenticated: false }
  const [available, authenticated] = await Promise.all([adapter.isAvailable(), adapter.checkAuth()])
  return { available, authenticated }
}
