import type { ConfigResult } from "./config.ts";

export interface SessionOverrides {
  enabled?: boolean;
  steering?: boolean;
}

export interface ScopeDecision {
  active: boolean;
  steering: boolean;
  reason: string;
}

export function evaluateScope(
  result: ConfigResult,
  model: { provider: string; id: string } | undefined,
  overrides: SessionOverrides,
): ScopeDecision {
  const inactive = (reason: string): ScopeDecision => ({ active: false, steering: false, reason });
  if (!result.valid) return inactive(`configuration error: ${result.error}`);
  if (!(overrides.enabled ?? result.config.enabled)) return inactive("disabled");
  if (!model) return inactive("no selected model");
  if (!result.config.providers.includes(model.provider)) return inactive("provider is not allowed");
  // Global and sticky regexes must not remember a previous request's match position.
  result.modelPattern.lastIndex = 0;
  const matched = result.modelPattern.test(model.id);
  result.modelPattern.lastIndex = 0;
  if (!matched) return inactive("model ID does not match modelIdPattern");
  return {
    active: true,
    steering: overrides.steering ?? result.config.steering,
    reason: "provider and model ID match",
  };
}
