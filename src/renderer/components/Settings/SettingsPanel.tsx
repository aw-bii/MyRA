import { useState, useEffect } from "react";
import { getSetting, setSetting } from "../../ipc/settings";
import { getAppVersion, storeKey, deleteKey, hasKey } from "../../ipc/key";
import { probeBackend } from "../../ipc/backend";
import { getProxySettings, setProxySettings } from "../../ipc/net";

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
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string } | null>>({});
  const [proxyHttp, setProxyHttp] = useState("");
  const [proxyHttps, setProxyHttps] = useState("");
  const [proxyNo, setProxyNo] = useState("");

  useEffect(() => {
    (async () => {
      const [appVersion, themeSetting, keyResults, proxy] = await Promise.all([
        getAppVersion().catch(() => ""),
        getSetting("theme").catch(() => null),
        Promise.all(
          API_PROVIDERS.map((p) =>
            hasKey(p.id)
              .then((exists) => ({ id: p.id, exists }))
              .catch(() => ({ id: p.id, exists: false })),
          ),
        ),
        getProxySettings().catch(() => ({
          httpProxy: "",
          httpsProxy: "",
          noProxy: "",
        })),
      ]);
      setVersion(appVersion);
      if (
        themeSetting === "light" ||
        themeSetting === "dark" ||
        themeSetting === "system"
      ) {
        setTheme(themeSetting);
      }
      setKeyStates(Object.fromEntries(keyResults.map((r) => [r.id, r.exists])));
      setProxyHttp(proxy.httpProxy);
      setProxyHttps(proxy.httpsProxy);
      setProxyNo(proxy.noProxy);
    })();
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
    const success = result.available && result.authenticated;
    const message = success
      ? `${provider}: connected and authenticated`
      : `${provider}: ${!result.available ? "not available" : "not authenticated"}`;
    setTestResults((prev) => ({ ...prev, [provider]: { success, message } }));
    if (success) {
      setTimeout(() => {
        setTestResults((prev) => ({ ...prev, [provider]: null }));
      }, 5000);
    }
  };

  return (
    <div className="w-full h-full overflow-y-auto bg-surface">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="font-semibold text-sm">Settings</span>
        <button
          onClick={onClose}
          className="btn-sm border border-border-strong hoverable:hover:bg-bubble"
        >
          Close
        </button>
      </div>
      <div className="p-4 space-y-4">
        <div>
          <label className="block text-xs font-medium mb-1">Theme</label>
          <select
            className="w-full text-xs border rounded px-2 py-1.5 bg-surface border-border-strong focus:outline-none focus:ring-2 focus:ring-primary"
            value={theme}
            onChange={(e) => handleThemeChange(e.target.value as typeof theme)}
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>

        <div className="border-t border-border pt-4">
          <span className="text-xs font-semibold block mb-2">API Keys</span>
          <div className="space-y-3">
            {API_PROVIDERS.map((p) => (
              <div key={p.id}>
                <label className="text-xs text-text-muted block mb-1">
                  {p.label}
                </label>
                {p.id === "ollama" ? (
                  <p className="text-xs text-text-muted italic">
                    No key needed — connects to localhost:11434
                  </p>
                ) : (
                  <>
                    <div className="flex gap-1">
                      {keyStates[p.id] ? (
                        <button
                          onClick={async () => {
                            await deleteKey(p.id);
                            setKeyStates((prev) => ({ ...prev, [p.id]: false }));
                          }}
                          className="btn-sm border border-danger-muted text-danger hoverable:hover:bg-danger-subtle text-xs px-2"
                        >
                          Remove
                        </button>
                      ) : (
                        <>
                          <input
                            type="password"
                            className="flex-1 text-xs border rounded px-2 py-1 bg-surface border-border-strong"
                            placeholder="sk-..."
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
                            className="btn-sm bg-primary text-on-primary hoverable:hover:bg-primary-dark text-xs px-2"
                          >
                            Save
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleTest(p.id)}
                        disabled={testing[p.id]}
                        className="btn-sm border border-border-strong text-xs px-2 hoverable:hover:bg-bubble"
                      >
                        {testing[p.id] ? "..." : "Test"}
                      </button>
                    </div>
                    {testResults[p.id] && (
                      <span className={`text-xs mt-1 block ${testResults[p.id]!.success ? "text-success" : "text-danger"}`}>
                        {testResults[p.id]!.message}
                      </span>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-border pt-4">
          <span className="text-xs font-semibold block mb-2">
            Network Proxy
          </span>
          <div className="space-y-2">
            <div>
              <label className="text-xs text-text-muted block mb-1">
                HTTP_PROXY
              </label>
              <input
                className="w-full text-xs border rounded px-2 py-1 bg-surface border-border-strong"
                placeholder="http://proxy:8080"
                value={proxyHttp}
                onChange={(e) => setProxyHttp(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-text-muted block mb-1">
                HTTPS_PROXY
              </label>
              <input
                className="w-full text-xs border rounded px-2 py-1 bg-surface border-border-strong"
                placeholder="https://proxy:8443"
                value={proxyHttps}
                onChange={(e) => setProxyHttps(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-text-muted block mb-1">
                NO_PROXY
              </label>
              <input
                className="w-full text-xs border rounded px-2 py-1 bg-surface border-border-strong"
                placeholder="localhost,127.0.0.1"
                value={proxyNo}
                onChange={(e) => setProxyNo(e.target.value)}
              />
            </div>
            <button
              onClick={saveProxy}
              className="btn-sm bg-primary text-on-primary hoverable:hover:bg-primary-dark text-xs w-full mt-1"
            >
              Save Proxy
            </button>
          </div>
        </div>

        <div>
          <button
            onClick={onReRunWizard}
            className="btn-sm w-full px-3 py-2 border border-border-strong hoverable:hover:bg-bubble"
          >
            Re-run Setup Wizard
          </button>
        </div>
        <div className="text-xs text-text-muted pt-4 border-t border-border">
          Version {version || "0.2.0"}
        </div>
      </div>
    </div>
  );
}
