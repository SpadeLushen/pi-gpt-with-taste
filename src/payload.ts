/**
 * Request-local compatibility guard for OpenAI wire formats. The host may replace
 * system messages after context_with_system (forceSystemPrompt), discarding our section.
 * Only append the missing behavioral block; never replace existing instructions or tools.
 */
export type PayloadProjection =
  | { supported: true; changed: boolean; payload: Record<string, unknown> }
  | { supported: false; payload: unknown };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function instructionText(message: unknown): string {
  if (!isRecord(message) || (message.role !== "system" && message.role !== "developer")) return "";
  if (typeof message.content === "string") return message.content;
  if (!Array.isArray(message.content)) return "";
  return message.content.map((part: unknown) => {
    if (!isRecord(part) || (part.type !== "text" && part.type !== "input_text")) return "";
    return typeof part.text === "string" ? part.text : "";
  }).join("\n");
}

export function ensurePayloadInstructions(payload: unknown, block: string): PayloadProjection {
  if (!isRecord(payload) || typeof payload.model !== "string") return { supported: false, payload };

  // Responses/Codex Responses: use the actual instructions field, not user/tool input.
  if (Array.isArray(payload.input)) {
    const existing = payload.instructions;
    if (existing !== undefined && existing !== null && typeof existing !== "string") {
      return { supported: false, payload };
    }
    if ((typeof existing === "string" && existing.includes(block)) ||
      payload.input.some((message: unknown) => instructionText(message).includes(block))) {
      return { supported: true, changed: false, payload };
    }
    return {
      supported: true,
      changed: true,
      payload: {
        ...payload,
        instructions: typeof existing === "string" && existing.length > 0 ? `${existing}\n\n${block}` : block,
      },
    };
  }

  // Chat Completions: preserve the existing instruction role and all content/metadata.
  if (Array.isArray(payload.messages)) {
    const messages: unknown[] = payload.messages;
    if (messages.some((message) => instructionText(message).includes(block))) {
      return { supported: true, changed: false, payload };
    }
    const index = messages.findIndex((message) =>
      isRecord(message) && (message.role === "system" || message.role === "developer"));
    const message = messages[index];
    if (!isRecord(message)) return { supported: false, payload };
    let content: unknown;
    if (typeof message.content === "string") {
      content = message.content.length > 0 ? `${message.content}\n\n${block}` : block;
    } else if (Array.isArray(message.content)) {
      content = [...message.content, { type: "text", text: block }];
    } else {
      return { supported: false, payload };
    }
    const updated = messages.slice();
    updated[index] = { ...message, content };
    return { supported: true, changed: true, payload: { ...payload, messages: updated } };
  }

  // Do not guess at other providers' instruction schemas.
  return { supported: false, payload };
}
