import { ipcMain, BrowserWindow, app } from "electron";
import { IPC } from "../shared/ipc";
import { AdapterManager, securityMiddleware } from "./adapters/manager";
import { ConvStore } from "./store";
import { probeBackend } from "./wizard/probe";
import { installBackend } from "./wizard/install";
import { pipelineRunner } from "./pipeline/runner";
import { AttachmentService } from "./attachments/service";
import { downloadUpdate, quitAndInstall } from "./updater";
import { CronStore } from "./scheduler/cron-store";
import { CronEngine } from "./scheduler/cron-engine";
import { McpClientManager } from "./mcp/mcp-client-manager";
import { PluginManager } from "./plugins/plugin-manager";
import { PathSecurity } from "./security/path-security";
import { WriteApproval } from "./security/write-approval";
import { KeyManager } from "./security/key-manager";
import https from "https";
import cron from "node-cron";
import path from "path";
import { spawn } from "child_process";

export const MAX_PROMPT_LENGTH = 100_000;
export const MAX_MESSAGE_LENGTH = 100_000;

export function validatePersona(p: {
  systemPrompt?: string;
  name?: string;
}): void {
  if (
    p.systemPrompt !== undefined &&
    p.systemPrompt.length > MAX_PROMPT_LENGTH
  ) {
    throw new Error(
      `System prompt exceeds maximum length of ${MAX_PROMPT_LENGTH} characters`,
    );
  }
}

export function registerIpcHandlers(win: BrowserWindow): void {
  // chat:send — starts streaming, pushes chat:chunk and chat:done via webContents
  ipcMain.handle(
    IPC.CHAT_SEND,
    async (
      event,
      {
        conversationId,
        message,
        backend,
        personaId,
        messageId: pregenMessageId,
        model,
      },
    ) => {
      if (typeof message !== "string") {
        throw new Error("Message must be a string");
      }
      if (message.length > MAX_MESSAGE_LENGTH) {
        throw new Error(
          `Message exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters`,
        );
      }
      const adapter = AdapterManager.get(backend) ?? AdapterManager.getActive();
      AdapterManager.setActive(adapter.id);
      if (model && typeof (adapter as any).setModel === "function") {
        (adapter as any).setModel(model);
      }

      const persona = personaId
        ? ConvStore.listPersonas().find((p) => p.id === personaId)
        : ConvStore.getDefaultPersona();

      let conv = conversationId
        ? ConvStore.getConversation(conversationId)
        : undefined;
      if (!conv) {
        conv = ConvStore.createConversation(
          message.slice(0, 60),
          adapter.id,
          persona?.id ?? null,
        );
      }

      ConvStore.createMessage({
        id: pregenMessageId,
        conversationId: conv.id,
        role: "user",
        content: message,
        backend: adapter.id,
        stepIndex: null,
      });

      const attachments = pregenMessageId
        ? AttachmentService.listForMessage(pregenMessageId)
        : [];

      let fullContent = "";
      const wrapped = securityMiddleware(
        adapter.send(message, persona?.systemPrompt, attachments),
        adapter.id,
        (evt) => {
          if (win) {
            win.webContents.send(IPC.SECURITY_EVENT, evt);
          } else {
            console.warn("security:event dropped (no window)", evt.type);
          }
        },
      );
      for await (const chunk of wrapped) {
        if (chunk.type === "text") fullContent += chunk.content;
        event.sender.send(IPC.CHAT_CHUNK, {
          ...chunk,
          conversationId: conv.id,
        });
        if (chunk.type === "done") break;
      }

      const saved = ConvStore.createMessage({
        conversationId: conv.id,
        role: "assistant",
        content: fullContent,
        backend: adapter.id,
        stepIndex: null,
      });
      event.sender.send(IPC.CHAT_DONE, {
        conversationId: conv.id,
        messageId: saved.id,
      });
      return conv.id;
    },
  );

  ipcMain.handle(IPC.CHAT_ABORT, (_event, { conversationId: _id }) => {
    AdapterManager.getActive().abort();
  });

  ipcMain.handle(IPC.CONV_LIST, (_event, { limit, offset }) =>
    ConvStore.listConversations(limit, offset),
  );

  ipcMain.handle(
    IPC.CONV_CREATE,
    (_event, { title, backend, personaId, pipelineTemplateId }) => {
      return ConvStore.createConversation(
        title || "New conversation",
        backend || "claude",
        personaId || null,
        pipelineTemplateId,
      );
    },
  );

  ipcMain.handle(IPC.CONV_GET, (_event, { conversationId }) => ({
    conversation: ConvStore.getConversation(conversationId),
    messages: ConvStore.getMessages(conversationId),
  }));

  ipcMain.handle(IPC.CONV_SEARCH, (_event, { query }) =>
    ConvStore.searchMessages(query),
  );

  ipcMain.handle(IPC.PERSONA_LIST, () => ConvStore.listPersonas());

  ipcMain.handle(IPC.PERSONA_SAVE, (_event, p) => {
    validatePersona(p);
    return p.id ? ConvStore.updatePersona(p.id, p) : ConvStore.createPersona(p);
  });

  ipcMain.handle(IPC.PERSONA_DELETE, (_event, { id }) =>
    ConvStore.deletePersona(id),
  );

  ipcMain.handle(IPC.BACKEND_LIST, () => AdapterManager.listAvailable());

  ipcMain.handle(IPC.WIZARD_PROBE, (_event, { backend }) =>
    probeBackend(backend),
  );

  ipcMain.handle(IPC.WIZARD_INSTALL, async (event, { backend }) => {
    const result = await installBackend(backend, (line) =>
      event.sender.send("wizard:install:line", backend, line),
    );
    if (result.success) {
      const probe = await probeBackend(backend);
      result.available = probe.available;
      result.authenticated = probe.authenticated;
    }
    return result;
  });

  ipcMain.handle(IPC.WIZARD_DONE, () => {
    ConvStore.setSetting("wizard_done", "1");
  });

  ipcMain.handle(IPC.NET_CHECK, async () => {
    try {
      await new Promise<void>((resolve, reject) => {
        const req = https.get(
          "https://registry.npmjs.org",
          { timeout: 5000 },
          () => {
            resolve();
          },
        );
        req.on("error", reject);
        req.on("timeout", () => {
          req.destroy();
          reject(new Error("timeout"));
        });
      });
      return { online: true };
    } catch {
      return { online: false };
    }
  });

  ipcMain.handle(IPC.NET_GET_PROXY, () => {
    return {
      httpProxy: ConvStore.getSetting("proxy_http") ?? "",
      httpsProxy: ConvStore.getSetting("proxy_https") ?? "",
      noProxy: ConvStore.getSetting("proxy_no") ?? "",
    };
  });

  ipcMain.handle(
    IPC.NET_SET_PROXY,
    (_event, { httpProxy, httpsProxy, noProxy }) => {
      ConvStore.setSetting("proxy_http", httpProxy || "");
      ConvStore.setSetting("proxy_https", httpsProxy || "");
      ConvStore.setSetting("proxy_no", noProxy || "");
    },
  );

  ipcMain.handle(IPC.CONV_DELETE, (_event, { conversationId }) => {
    ConvStore.deleteConversation(conversationId);
  });

  ipcMain.handle(IPC.CONV_RENAME, (_event, { conversationId, title }) => {
    if (typeof title !== "string" || title.trim().length === 0)
      throw new Error("Title must be a non-empty string");
    ConvStore.renameConversation(conversationId, title.trim());
  });

  ipcMain.handle(IPC.APP_VERSION, () => app.getVersion());

  ipcMain.handle(IPC.APP_RELAUNCH, () => {
    app.relaunch();
    app.exit(0);
  });

  ipcMain.handle(IPC.SETTING_GET, (_event, { key }) =>
    ConvStore.getSetting(key),
  );
  ipcMain.handle(IPC.SETTING_SET, (_event, { key, value }) =>
    ConvStore.setSetting(key, value),
  );
  ipcMain.handle(IPC.SETTING_GET_ALL, () => ConvStore.getAllSettings());

  ipcMain.handle(IPC.KEY_STORE, (_event, { provider, key }) => {
    KeyManager.storeKey(provider, key);
  });
  ipcMain.handle(IPC.KEY_GET, (_event, { provider }) =>
    KeyManager.getKey(provider),
  );
  ipcMain.handle(IPC.KEY_DELETE, (_event, { provider }) => {
    KeyManager.deleteKey(provider);
  });
  ipcMain.handle(IPC.KEY_HAS, (_event, { provider }) =>
    KeyManager.hasKey(provider),
  );
  ipcMain.handle(IPC.KEY_LIST, () => KeyManager.listProviders());

  ipcMain.handle(IPC.MODEL_GET_DEFAULT, (_event, { provider }) => {
    const model = ConvStore.getSetting(`model:${provider}`);
    return model || "";
  });
  ipcMain.handle(IPC.MODEL_SET_DEFAULT, (_event, { provider, model }) => {
    ConvStore.setSetting(`model:${provider}`, model);
  });
  ipcMain.handle(IPC.MODEL_LIST, async (_event, { provider }) => {
    const adapter = AdapterManager.get(provider);
    if (!adapter || !("listModels" in adapter)) return [];
    return (adapter as any).listModels();
  });

  ipcMain.handle(IPC.PIPELINE_LIST, () => ConvStore.listPipelineTemplates());

  ipcMain.handle(IPC.PIPELINE_SAVE, (_event, { id, name, steps }) => {
    if (!name || typeof name !== "string")
      throw new Error("Pipeline name is required");
    if (!Array.isArray(steps) || steps.length < 2)
      throw new Error("Pipeline must have at least 2 steps");
    return id
      ? ConvStore.updatePipelineTemplate(id, name, steps)
      : ConvStore.createPipelineTemplate(name, steps);
  });

  ipcMain.handle(IPC.PIPELINE_DELETE, (_event, { id }) =>
    ConvStore.deletePipelineTemplate(id),
  );

  ipcMain.handle(
    IPC.PIPELINE_RUN,
    async (event, { conversationId, message, templateId }) => {
      if (typeof message !== "string" || message.length > MAX_MESSAGE_LENGTH) {
        throw new Error(
          `Message exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters`,
        );
      }

      const template = ConvStore.getPipelineTemplate(templateId);
      if (!template)
        throw new Error(`Pipeline template not found: ${templateId}`);
      if (template.steps.length < 2)
        throw new Error("Pipeline must have at least 2 steps");

      const personas = ConvStore.listPersonas();
      const resolvedSteps = template.steps.map((step) => ({
        adapterId: step.backendId,
        persona: step.personaId
          ? personas.find((p) => p.id === step.personaId)?.systemPrompt
          : undefined,
      }));

      let conv = conversationId
        ? ConvStore.getConversation(conversationId)
        : undefined;
      if (!conv) {
        conv = ConvStore.createPipelineConversation(
          message.slice(0, 60),
          templateId,
        );
      }

      ConvStore.createMessage({
        conversationId: conv.id,
        role: "user",
        content: message,
        backend: "pipeline",
        stepIndex: null,
      });

      const accumulators: string[] = new Array(resolvedSteps.length).fill("");

      await pipelineRunner.run({
        conversationId: conv.id,
        userMessage: message,
        steps: resolvedSteps,
        onChunk: (chunk) => {
          if (chunk.type === "text")
            accumulators[chunk.stepIndex] += chunk.content;
          event.sender.send(IPC.PIPELINE_CHUNK, {
            ...chunk,
            conversationId: conv!.id,
          });
        },
        onStepDone: (stepIndex) => {
          ConvStore.createMessage({
            conversationId: conv!.id,
            role: "assistant",
            content: accumulators[stepIndex],
            backend: resolvedSteps[stepIndex].adapterId,
            stepIndex,
          });
          event.sender.send(IPC.PIPELINE_STEP_DONE, {
            conversationId: conv!.id,
            stepIndex,
          });
        },
      });

      event.sender.send(IPC.PIPELINE_DONE, { conversationId: conv!.id });
      return conv.id;
    },
  );

  ipcMain.handle(IPC.PIPELINE_ABORT, (_event, { conversationId }) => {
    pipelineRunner.abort(conversationId);
  });

  ipcMain.handle(
    IPC.ATTACHMENT_INGEST,
    async (_event, { filePaths, messageId }) => {
      if (
        !Array.isArray(filePaths) ||
        filePaths.some((p) => typeof p !== "string") ||
        typeof messageId !== "string" ||
        messageId.length === 0
      ) {
        throw new Error(
          "ATTACHMENT_INGEST requires { filePaths: string[], messageId: string }",
        );
      }
      return AttachmentService.ingest(
        filePaths,
        messageId,
        app.getPath("userData"),
      );
    },
  );

  ipcMain.handle(IPC.ATTACHMENT_LIST, (_event, { messageId }) => {
    return AttachmentService.listForMessage(messageId);
  });

  ipcMain.handle(IPC.ATTACHMENT_DATA_URL, (_event, { storedPath }) => {
    const userData = app.getPath("userData");
    const check = PathSecurity.resolveSafePath(storedPath, [
      path.join(userData, "attachments"),
    ]);
    if (!check.allowed) {
      throw new Error(`Access denied: ${check.reason}`);
    }
    return AttachmentService.getDataUrl(check.resolvedPath);
  });

  ipcMain.handle(IPC.SECURITY_RESPOND, (_event, { id, approved }) => {
    if (typeof id !== "string" || typeof approved !== "boolean") {
      throw new Error(
        "SECURITY_RESPOND requires { id: string, approved: boolean }",
      );
    }
    WriteApproval.respond(id, approved);
  });

  ipcMain.handle(IPC.UPDATE_DOWNLOAD, () => downloadUpdate());
  ipcMain.handle(IPC.UPDATE_INSTALL, () => quitAndInstall());

  ipcMain.handle(IPC.CRON_LIST, () => CronStore.list());
  ipcMain.handle(IPC.CRON_CREATE, (_event, input) => {
    if (
      typeof input?.cronExpression !== "string" ||
      !cron.validate(input.cronExpression)
    ) {
      throw new Error(`Invalid cron expression: "${input?.cronExpression}"`);
    }
    if (typeof input?.prompt === "string" && input.prompt.includes("\x00")) {
      throw new Error("Cron prompt must not contain null bytes");
    }
    const job = CronStore.create(input);
    if (job.status === "active") CronEngine.scheduleJob(job);
    return job;
  });
  ipcMain.handle(IPC.CRON_UPDATE, (_event, { id, ...changes }) => {
    if (changes.cronExpression !== undefined) {
      if (
        typeof changes.cronExpression !== "string" ||
        !cron.validate(changes.cronExpression)
      ) {
        throw new Error(`Invalid cron expression: "${changes.cronExpression}"`);
      }
    }
    if (typeof changes.prompt === "string" && changes.prompt.includes("\x00")) {
      throw new Error("Cron prompt must not contain null bytes");
    }
    CronStore.update(id, changes);
    const job = CronStore.get(id);
    if (job) {
      CronEngine.unscheduleJob(id);
      if (job.status === "active") CronEngine.scheduleJob(job);
    }
    return job;
  });
  ipcMain.handle(IPC.CRON_DELETE, (_event, { id }) => {
    CronEngine.unscheduleJob(id);
    CronStore.delete(id);
  });
  ipcMain.handle(IPC.CRON_TOGGLE, (_event, { id }) => {
    CronStore.toggle(id);
    const job = CronStore.get(id);
    if (job) {
      CronEngine.unscheduleJob(id);
      if (job.status === "active") CronEngine.scheduleJob(job);
    }
    return job;
  });
  ipcMain.handle(IPC.CRON_LOGS, (_event, { cronJobId }) =>
    CronStore.getLogs(cronJobId),
  );
  ipcMain.handle(IPC.CRON_RUN_NOW, async (_event, { id }) => {
    await CronEngine.executeJob(id);
  });

  ipcMain.handle(IPC.MCP_LIST_SERVERS, () => McpClientManager.getServers());
  ipcMain.handle(IPC.MCP_ADD_SERVER, (_event, config) => {
    if (
      typeof config?.name !== "string" ||
      typeof config?.command !== "string" ||
      !Array.isArray(config?.args)
    ) {
      throw new Error(
        "MCP_ADD_SERVER requires { name: string, command: string, args: string[] }",
      );
    }
    return McpClientManager.addServer(config);
  });
  ipcMain.handle(IPC.MCP_REMOVE_SERVER, (_event, { id }) =>
    McpClientManager.removeServer(id),
  );
  ipcMain.handle(IPC.MCP_TOGGLE_SERVER, (_event, { id }) => {
    const servers = McpClientManager.getServers();
    const s = servers.find((srv) => srv.id === id);
    if (s) {
      s.enabled = !s.enabled;
      if (!s.enabled) McpClientManager.disconnect(id);
    }
    return s;
  });
  ipcMain.handle(IPC.MCP_LIST_TOOLS, () => McpClientManager.getTools());
  ipcMain.handle(IPC.MCP_CALL_TOOL, (_event, request) =>
    McpClientManager.callTool(request),
  );

  ipcMain.handle(IPC.PLUGIN_LIST, () => PluginManager.list());
  ipcMain.handle(IPC.PLUGIN_TOGGLE, (_event, { id }) => {
    PluginManager.toggle(id);
    return PluginManager.list();
  });
  ipcMain.handle(IPC.PLUGIN_RELOAD, async () => {
    const pluginDir = path.join(app.getPath("userData"), "plugins");
    await PluginManager.reload(pluginDir);
  });

  ipcMain.handle(IPC.OLLAMA_START, () => {
    try {
      const child = spawn("ollama", ["serve"], {
        detached: true,
        stdio: "ignore",
      });
      child.on("error", () => {});
      child.unref();
    } catch (err) {
      throw new Error(
        `Failed to start Ollama: ${(err as Error).message}. Is Ollama installed and on PATH?`,
      );
    }
  });
}
