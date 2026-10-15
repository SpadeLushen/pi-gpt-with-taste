import { readFileSync } from "node:fs";
import path from "node:path";

export interface TasteConfig {
  enabled: boolean;
  steering: boolean;
  providers: string[];
  modelIdPattern: string;
}

export interface ConfigSource {
  path: string;
  loaded: boolean;
}

export type ConfigResult =
  | { valid: true; config: TasteConfig; modelPattern: RegExp; sources: ConfigSource[] }
  | { valid: false; error: string; sources: ConfigSource[] };

export const DEFAULT_CONFIG: Readonly<TasteConfig> = {
  enabled: true,
  steering: true,
  providers: ["openai", "openai-codex"],
  modelIdPattern: "/^gpt-/",
};

export function configPaths(agentDir: string, cwd: string) {
  return {
    user: path.join(agentDir, "extensions", "pi-gpt-with-taste", "config.json"),
    project: path.join(cwd, ".pi", "gpt-with-taste.json"),
  };
}

export function compileModelPattern(value: string): RegExp {
  const end = value.lastIndexOf("/");
  if (!value.startsWith("/") || end < 1) {
    throw new Error('modelIdPattern must use "/pattern/flags", for example "/^gpt-/i"');
  }
  try {
    return new RegExp(value.slice(1, end), value.slice(end + 1));
  } catch (error) {
    throw new Error(`Invalid modelIdPattern: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function readLayer(file: string): Partial<TasteConfig> | undefined {
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return undefined;
    throw error;
  }
  const value: unknown = JSON.parse(text);
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Expected a JSON object");
  }
  const layer: Partial<TasteConfig> = {};
  for (const [key, item] of Object.entries(value)) {
    switch (key) {
      case "enabled":
      case "steering":
        if (typeof item !== "boolean") throw new Error(`${key} must be a boolean`);
        layer[key] = item;
        break;
      case "providers":
        if (!Array.isArray(item) || !item.every((provider: unknown) =>
          typeof provider === "string" && provider.length > 0 && provider.trim() === provider)) {
          throw new Error("providers must be an array of nonempty provider IDs without surrounding whitespace");
        }
        layer.providers = [...new Set(item as string[])];
        break;
      case "modelIdPattern":
        if (typeof item !== "string") throw new Error("modelIdPattern must be a string");
        compileModelPattern(item);
        layer.modelIdPattern = item;
        break;
      default:
        throw new Error(`Unknown configuration field: ${key}`);
    }
  }
  return layer;
}

export function loadConfig(agentDir: string, cwd: string, projectTrusted: boolean): ConfigResult {
  const paths = configPaths(agentDir, cwd);
  const sources: ConfigSource[] = [];
  let config: TasteConfig = { ...DEFAULT_CONFIG, providers: [...DEFAULT_CONFIG.providers] };
  for (const file of [paths.user, ...(projectTrusted ? [paths.project] : [])]) {
    const source: ConfigSource = { path: file, loaded: false };
    sources.push(source);
    try {
      const layer = readLayer(file);
      if (layer) {
        source.loaded = true;
        config = { ...config, ...layer };
      }
    } catch (error) {
      return {
        valid: false,
        error: `${file}: ${error instanceof Error ? error.message : String(error)}`,
        sources,
      };
    }
  }
  return { valid: true, config, modelPattern: compileModelPattern(config.modelIdPattern), sources };
}
