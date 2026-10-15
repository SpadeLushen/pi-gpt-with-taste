import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { SessionOverrides } from "./scope.ts";

export const STATE_TYPE = "gpt-with-taste:state";

export function readOverrides(ctx: ExtensionContext): SessionOverrides {
  const branch = ctx.sessionManager.getBranch();
  for (let index = branch.length - 1; index >= 0; index--) {
    const entry = branch[index];
    if (entry.type !== "custom" || entry.customType !== STATE_TYPE) continue;
    const data: unknown = entry.data;
    if (typeof data !== "object" || data === null || Array.isArray(data)) continue;
    const overrides: SessionOverrides = {};
    if ("enabled" in data && typeof data.enabled === "boolean") overrides.enabled = data.enabled;
    if ("steering" in data && typeof data.steering === "boolean") overrides.steering = data.steering;
    return overrides;
  }
  return {};
}
