import { useState, useEffect } from "react";
import {
  getSetting,
  setSetting,
  getAppVersion,
  storeKey,
  deleteKey,
  hasKey,
  probeBackend,
  getProxySettings,
  setProxySettings,
} from "../../ipc";

const API_PROVIDERS = [
  { id: "openai", label: "OpenAI" },
  { id: "openrouter", label: "OpenRouter" },
  { id: "claude-api", label: "Claude API" },
  { id: "gemini-api", label: "Gemini API" },
  { id: "ollama", label: "Ollama" },
];

interface Props {
  onClose: () => void;
  onReRunWizard: () => void;
}

export function SettingsPanel({ onClose, onReRunWizard }: Props) {
  const [theme, setTheme] = useState<"system" | "light" | "dark">("system");
  const [version, setVersion] = useState("");
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [keyStates, setKeyStates] = useState<Record<string, boolean>>({});
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [proxyHttp, setProxyHttp] = useState("");
  const [proxyHttps, setProxyHttps] = useState("");
  const [proxyNo, setProxyNo] = useState("");

  useEffect(() => {
    getAppVersion().then(setVersion);
  }, []);

  useEffect(() => {
    getSetting("theme").then((v) => {
      if (v === "light" || v === "dark" || v === "system")
        setTheme(v as typeof theme);
    });
  }, []);

  useEffect(() => {
    Promise.all(
      API_PROVIDERS.map(async (p) => {
        const exists = await hasKey(p.id);
        return { id: p.id, exists };
      }),
    ).then((results) => {
      setKeyStates(Object.fromEntries(results.map((r) => [r.id, r.exists])));
    });
  }, []);

  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      document.documentElement.classList.toggle("dark", e.matches);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  useEffect(() => {
    getProxySettings()
      .then((p) => {
        setProxyHttp(p.httpProxy);
        setProxyHttps(p.httpsProxy);
        setProxyNo(p.noProxy);
      })
      .catch(() => {});
  }, []);

  const saveProxy = async () => {
    await setProxySettings({
      httpProxy: proxyHttp,
      httpsProxy: proxyHttps,
      noProxy: proxyNo,
    });
  };

  const handleThemeChange = async (t: "system" | "light" | "dark") => {
    setTheme(t);
    await setSetting("theme", t);
    if (t === "dark") document.documentElement.classList.add("dark");
    else if (t === "light") document.documentElement.classList.remove("dark");
    else {
      const prefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)",
      ).matches;
      document.documentElement.classList.toggle("dark", prefersDark);
    }
  };

  const handleSaveKey = async (provider: string) => {
    const key = apiKeys[provider]?.trim();
    if (!key) {
      await deleteKey(provider);
      setKeyStates((prev) => ({ ...prev, [provider]: false }));
    } else {
      await storeKey(provider, key);
      setKeyStates((prev) => ({ ...prev, [provider]: true }));
    }
    setApiKeys((prev) => ({ ...prev, [provider]: "" }));
  };

  const handleTest = async (provider: string) => {
    setTesting((prev) => ({ ...prev, [provider]: true }));
    const result = await probeBackend(provider);
    setTesting((prev) => ({ ...prev, [provider]: false }));
    alert(
      result.available && result.authenticated
        ? `${provider}: connected and authenticated`
        : `${provider}: ${!result.available ? "not available" : "not authenticated"}`,
    );
  };

  return (
    <div className="w-full overflow-y-auto bg-gray-50 dark:bg-gray-900">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <span className="font-semibold text-sm">Settings</span>
        <button
          onClick={onClose}
          className="btn-sm border border-gray-300 dark:border-gray-600 hoverable:hover:bg-gray-100 dark:hoverable:hover:bg-gray-800"
        >
          Close
        </button>
      </div>
      <div className="p-4 space-y-4">
        <div>
          <label className="block text-xs font-medium mb-1">Theme</label>
          <select
            className="w-full text-xs border rounded px-2 py-1.5 dark:bg-gray-800 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={theme}
            onChange={(e) => handleThemeChange(e.target.value as typeof theme)}
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <span className="text-xs font-semibold block mb-2">API Keys</span>
          <div className="space-y-3">
            {API_PROVIDERS.map((p) => (
              <div key={p.id}>
                <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">
                  {p.label}
                </label>
                {p.id === "ollama" ? (
                  <p className="text-xs text-gray-400 dark:text-gray-500 italic">
                    No key needed — connects to localhost:11434
                  </p>
                ) : (
                  <div className="flex gap-1">
                    <input
                      type="password"
                      className="flex-1 text-xs border rounded px-2 py-1 dark:bg-gray-800 dark:border-gray-600"
                      placeholder={
                        keyStates[p.id] ? "Key set — blank to delete" : "sk-..."
                      }
                      value={apiKeys[p.id] ?? ""}
                      onChange={(e) =>
                        setApiKeys((prev) => ({
                          ...prev,
                          [p.id]: e.target.value,
                        }))
                      }
                    />
                    <button
                      onClick={() => handleSaveKey(p.id)}
                      className="btn-sm bg-blue-600 text-white hoverable:hover:bg-blue-700 text-xs px-2"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => handleTest(p.id)}
                      disabled={testing[p.id]}
                      className="btn-sm border border-gray-300 dark:border-gray-600 text-xs px-2 hoverable:hover:bg-gray-100 dark:hoverable:hover:bg-gray-800"
                    >
                      {testing[p.id] ? "..." : "Test"}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <span className="text-xs font-semibold block mb-2">
            Network Proxy
          </span>
          <div className="space-y-2">
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">
                HTTP_PROXY
              </label>
              <input
                className="w-full text-xs border rounded px-2 py-1 dark:bg-gray-800 dark:border-gray-600"
                placeholder="http://proxy:8080"
                value={proxyHttp}
                onChange={(e) => setProxyHttp(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">
                HTTPS_PROXY
              </label>
              <input
                className="w-full text-xs border rounded px-2 py-1 dark:bg-gray-800 dark:border-gray-600"
                placeholder="https://proxy:8443"
                value={proxyHttps}
                onChange={(e) => setProxyHttps(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">
                NO_PROXY
              </label>
              <input
                className="w-full text-xs border rounded px-2 py-1 dark:bg-gray-800 dark:border-gray-600"
                placeholder="localhost,127.0.0.1"
                value={proxyNo}
                onChange={(e) => setProxyNo(e.target.value)}
              />
            </div>
            <button
              onClick={saveProxy}
              className="btn-sm bg-blue-600 text-white hoverable:hover:bg-blue-700 text-xs w-full mt-1"
            >
              Save Proxy
            </button>
          </div>
        </div>

        <div>
          <button
            onClick={onReRunWizard}
            className="btn-sm w-full px-3 py-2 border border-gray-300 dark:border-gray-600 hoverable:hover:bg-gray-100 dark:hoverable:hover:bg-gray-800"
          >
            Re-run Setup Wizard
          </button>
        </div>
        <div className="text-xs text-gray-400 pt-4 border-t border-gray-200 dark:border-gray-700">
          Version {version || "0.1.0"}
        </div>
      </div>
    </div>
  );
}
