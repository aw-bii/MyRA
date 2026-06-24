import { safeStorage } from "electron";
import { ConvStore } from "../store";

function settingKey(provider: string): string {
  return `key:${provider}`;
}

function toHex(buf: Buffer): string {
  return buf.toString("hex");
}

function fromHex(hex: string): Buffer {
  return Buffer.from(hex, "hex");
}

function encryptionAvailable(): boolean {
  return safeStorage.isEncryptionAvailable();
}

if (!safeStorage.isEncryptionAvailable()) {
  console.warn(
    "[KeyManager] safeStorage unavailable — API keys will be stored as plaintext",
  );
}

export const KeyManager = {
  storeKey(provider: string, key: string): void {
    const value = encryptionAvailable()
      ? toHex(safeStorage.encryptString(key))
      : key;
    ConvStore.setSetting(settingKey(provider), value);
  },

  getKey(provider: string): string | null {
    const stored = ConvStore.getSetting(settingKey(provider));
    if (!stored) return null;
    try {
      return encryptionAvailable()
        ? safeStorage.decryptString(fromHex(stored))
        : stored;
    } catch {
      return null;
    }
  },

  deleteKey(provider: string): void {
    ConvStore.setSetting(settingKey(provider), "");
  },

  hasKey(provider: string): boolean {
    const val = this.getKey(provider);
    return val !== null && val.length > 0;
  },

  listProviders(): string[] {
    const all = ConvStore.getAllSettings();
    const providers: string[] = [];
    for (const key of Object.keys(all)) {
      if (key.startsWith("key:") && all[key].length > 0) {
        providers.push(key.slice(4));
      }
    }
    return providers;
  },
};
