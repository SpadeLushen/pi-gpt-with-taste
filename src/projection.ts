import type { AgentMessage } from "@earendil-works/pi-agent-core";
import { formatInstructions, type Instructions, type TasteRole } from "./instructions.ts";

const SECTION = "gpt_with_taste";
const STEER_TYPE = "gpt-with-taste:steer";

export interface ProjectionOptions {
  role: TasteRole;
  active: boolean;
  steering: boolean;
  completedResultTypes: ReadonlySet<string>;
}

export function projectInstructions(
  input: AgentMessage[],
  instructions: Instructions,
  options: ProjectionOptions,
): AgentMessage[] {
  // Only remove our own request-local additions. Never edit user text, results, or other sections.
  const messages = input.filter((message) =>
    !(message.role === "custom" && message.customType === STEER_TYPE)).map((message) => {
    if (message.role !== "system" || !message.sections || !(SECTION in message.sections)) return message;
    const sections = { ...message.sections };
    delete sections[SECTION];
    return { ...message, sections };
  });
  if (!options.active) return messages;
  const leading = messages[0];
  if (leading?.role !== "system") {
    throw new Error("Cannot inject GPT with Taste without pi's leading system message");
  }
  messages[0] = {
    ...leading,
    sections: {
      ...leading.sections,
      [SECTION]: formatInstructions(instructions, options.role),
    },
  };
  if (!options.steering) return messages;

  // A tool continuation has an assistant message after the input, so it gets no repeated
  // user reminder. Queued steering/follow-up inputs appear in this suffix before dispatch.
  let lastAssistant = -1;
  for (let index = messages.length - 1; index >= 0; index--) {
    if (messages[index].role === "assistant") {
      lastAssistant = index;
      break;
    }
  }
  const projected: AgentMessage[] = [];
  for (let index = 0; index < messages.length; index++) {
    const message = messages[index];
    projected.push(message);
    if (index <= lastAssistant) continue;
    let route: "user" | "sub" | "agent" | undefined;
    if (message.role === "user") route = options.role === "sub" ? "sub" : "user";
    else if (options.role === "main" && message.role === "custom" &&
      options.completedResultTypes.has(message.customType)) route = "agent";
    if (!route) continue;
    const text = route === "user" ? instructions.userSteer :
      route === "sub" ? instructions.subSteer : instructions.agentSteer;
    projected.push({
      role: "custom",
      customType: STEER_TYPE,
      content: `<gpt-with-taste-${route}-steer>\n${text}\n</gpt-with-taste-${route}-steer>`,
      display: false,
      details: { route },
      timestamp: message.timestamp,
    });
  }
  return projected;
}
