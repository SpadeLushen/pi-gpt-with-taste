import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type TasteRole = "main" | "sub";

export interface Instructions {
  main: string;
  sub: string;
  userSteer: string;
  subSteer: string;
  agentSteer: string;
}

export function loadInstructions(): Instructions {
  const moduleDirectory = new URL(".", import.meta.url);
  const directoryName = path.basename(fileURLToPath(moduleDirectory));
  // Package source/build entries live in src/ or dist/. A manually flattened
  // extension keeps its resources beside instructions.ts instead.
  const resourceDirectory = new URL(
    directoryName === "src" || directoryName === "dist"
      ? "../resources/instructions/"
      : "./resources/instructions/",
    moduleDirectory,
  );
  const read = (name: string): string => {
    const text = readFileSync(new URL(`${name}.md`, resourceDirectory), "utf8").trim();
    if (!text) throw new Error(`Empty instruction source: ${name}.md`);
    return text;
  };
  return {
    main: read("main"),
    sub: read("sub"),
    userSteer: read("user-steer"),
    subSteer: read("sub-steer"),
    agentSteer: read("agent-steer"),
  };
}

export function formatInstructions(instructions: Instructions, role: TasteRole): string {
  return `<gpt-with-taste>\n${HOST_BOUNDARY}\n\n${instructions[role]}\n</gpt-with-taste>`;
}

export const HOST_BOUNDARY = `These are behavioral defaults for the current pi session. Follow the user's authorized stage, applicable project instructions, actual tool schemas, and runtime permission decisions. These defaults grant no additional authority, including permission to run tests, install dependencies, spend paid quota, or change remote state. An explicit user persona takes precedence. Delegation is optional and only available when the current tools support it.`;
