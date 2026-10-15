import {
  getAgentDir,
  VERSION,
  type ExtensionAPI,
  type ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { configPaths, loadConfig, type ConfigResult } from "./config.ts";
import { formatInstructions, loadInstructions, type TasteRole } from "./instructions.ts";
import { ensurePayloadInstructions } from "./payload.ts";
import { projectInstructions } from "./projection.ts";
import { evaluateScope } from "./scope.ts";
import { readOverrides, STATE_TYPE } from "./state.ts";

export interface TasteExtensionOptions {
  /** Child integrations must select "sub" explicitly; input source is not an agent role. */
  role?: TasteRole;
  /** Only trusted integrations should name custom types that guarantee completed results. */
  completedResultTypes?: readonly string[];
}

function report(ctx: ExtensionContext, text: string, level: "info" | "warning" | "error" = "info"): void {
  if (ctx.hasUI) ctx.ui.notify(text, level);
  else console.error(`GPT with Taste: ${text}`);
}

export function createTasteExtension(options: TasteExtensionOptions = {}) {
  const role = options.role ?? "main";
  if (role !== "main" && role !== "sub") throw new Error("GPT with Taste role must be main or sub");
  const completedResultTypes = new Set(options.completedResultTypes ?? []);

  return function tasteExtension(pi: ExtensionAPI): void {
    const [major, minor] = VERSION.split(".").map(Number);
    if (major < 1 || (major === 1 && minor < 2)) {
      throw new Error(`GPT with Taste requires pi 1.2.0 or newer (found ${VERSION})`);
    }
    const instructions = loadInstructions();
    let loaded: ConfigResult | undefined;
    let loadedKey: string | undefined;
    let lastProjectionError: string | undefined;
    let unsupportedPayloadReported = false;

    function getConfig(ctx: ExtensionContext, reload = false): ConfigResult {
      const agentDir = getAgentDir();
      const trusted = ctx.isProjectTrusted();
      const key = JSON.stringify([agentDir, ctx.cwd, trusted]);
      if (reload || !loaded || key !== loadedKey) {
        loaded = loadConfig(agentDir, ctx.cwd, trusted);
        loadedKey = key;
        if (!loaded.valid) report(ctx, `Injection paused. ${loaded.error}`, "error");
      }
      return loaded;
    }

    function status(ctx: ExtensionContext): string {
      const config = getConfig(ctx);
      const overrides = readOverrides(ctx);
      const decision = evaluateScope(config, ctx.model, overrides);
      const sources = config.sources.filter((source) => source.loaded).map((source) => source.path);
      return [
        `Role: ${role}`,
        `Selected model: ${ctx.model ? `${ctx.model.provider}/${ctx.model.id}` : "(none)"}`,
        `Active: ${decision.active ? "yes" : "no"} — ${decision.reason}`,
        `Steering: ${decision.steering ? "on" : "off"}`,
        `Session overrides: ${JSON.stringify(overrides)}`,
        `Configuration: ${!config.valid ? "invalid (injection paused)" : sources.length ? sources.join(", ") : "built-in defaults"}`,
        "Scope matches the selected model, not a virtual model's routed target.",
      ].join("\n");
    }

    function refreshStatus(ctx: ExtensionContext): void {
      const decision = evaluateScope(getConfig(ctx), ctx.model, readOverrides(ctx));
      if (ctx.mode === "tui") {
        ctx.ui.setStatus("gpt-with-taste", decision.active ? `taste: ${role}` : "taste: off");
      }
    }

    pi.on("session_start", (_event, ctx) => {
      getConfig(ctx, true);
      refreshStatus(ctx);
    });
    pi.on("session_tree", (_event, ctx) => refreshStatus(ctx));
    pi.on("session_compact", (_event, ctx) => refreshStatus(ctx));
    pi.on("model_select", (_event, ctx) => refreshStatus(ctx));
    // Startup can originate from a user or a custom message in pi 1.2.0. Do not return
    // a persisted reminder here; request-local projection uses the actual transcript.
    pi.on("before_agent_start", (_event, ctx) => {
      getConfig(ctx);
    });
    pi.on("context_with_system", (event, ctx) => {
      const decision = evaluateScope(getConfig(ctx), ctx.model, readOverrides(ctx));
      try {
        const messages = projectInstructions(event.messages, instructions, {
          role,
          active: decision.active,
          steering: decision.steering,
          completedResultTypes,
        });
        lastProjectionError = undefined;
        return { messages };
      } catch (error) {
        const text = error instanceof Error ? error.message : String(error);
        if (lastProjectionError !== text) report(ctx, `Injection skipped. ${text}`, "error");
        lastProjectionError = text;
        // No partial projection escapes: projectInstructions never mutates event.messages.
        return { messages: event.messages };
      }
    });

    pi.on("before_provider_request", (event, ctx) => {
      const decision = evaluateScope(getConfig(ctx), ctx.model, readOverrides(ctx));
      if (!decision.active) return;
      // Runs after the host's forced-system-prompt projection and wire serialization.
      // Preserve automode and other existing guidance; only append our missing block.
      const result = ensurePayloadInstructions(event.payload, formatInstructions(instructions, role));
      if (!result.supported) {
        if (!unsupportedPayloadReported) {
          report(ctx, "Final-request instruction guard does not support this payload format. Named-section injection still applies, but forced system prompts may override it.", "warning");
        }
        unsupportedPayloadReported = true;
        return;
      }
      unsupportedPayloadReported = false;
      if (result.changed) return result.payload;
    });

    pi.registerCommand("taste", {
      description: "GPT with Taste: on, off, status, config, reload, reset, steer on|off",
      getArgumentCompletions(prefix) {
        return ["on", "off", "status", "config", "reload", "reset", "steer on", "steer off"]
          .filter((value) => value.startsWith(prefix))
          .map((value) => ({ value, label: value }));
      },
      handler: async (args, ctx) => {
        const command = args.trim() || "status";
        if (command === "status") {
          report(ctx, status(ctx));
          return;
        }
        if (command === "config") {
          const config = getConfig(ctx);
          const paths = configPaths(getAgentDir(), ctx.cwd);
          report(ctx, [
            config.valid ? JSON.stringify(config.config, null, 2) : `Injection paused: ${config.error}`,
            `User file: ${paths.user}`,
            `Project file: ${paths.project} (${ctx.isProjectTrusted() ? "trusted" : "ignored: untrusted"})`,
            ...config.sources.map((source) => `${source.loaded ? "Loaded" : "Not loaded"}: ${source.path}`),
            "Edit the JSON file, then run /taste reload. providers replaces the inherited list.",
          ].join("\n"));
          return;
        }
        if (command === "reload") {
          getConfig(ctx, true);
          refreshStatus(ctx);
          report(ctx, status(ctx));
          return;
        }
        if (["on", "off", "reset", "steer on", "steer off"].includes(command)) {
          const overrides = command === "reset" ? {} : readOverrides(ctx);
          if (command === "on" || command === "off") overrides.enabled = command === "on";
          if (command.startsWith("steer ")) overrides.steering = command === "steer on";
          pi.appendEntry(STATE_TYPE, overrides);
          refreshStatus(ctx);
          report(ctx, status(ctx));
          return;
        }
        report(ctx, "Usage: /taste on|off|status|config|reload|reset|steer on|steer off", "warning");
      },
    });
  };
}
