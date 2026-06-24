import { AdapterManager } from "../adapters/manager";

export async function probeBackend(
  id: string,
  timeoutMs = 10_000,
): Promise<{ available: boolean; authenticated: boolean }> {
  const adapter = AdapterManager.get(id);
  if (!adapter) return { available: false, authenticated: false };

  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Probe timed out for ${id}`)), timeoutMs),
  );

  try {
    const [available, authenticated] = await Promise.race([
      Promise.all([adapter.isAvailable(), adapter.checkAuth()]),
      timeout,
    ]);
    return { available, authenticated };
  } catch {
    return { available: false, authenticated: false };
  }
}
