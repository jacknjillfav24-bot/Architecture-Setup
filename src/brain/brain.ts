/** Something an agent needs to decide or say. */
export interface ThoughtRequest {
  /** Who is thinking. Used as the AI's system prompt. */
  persona: string;
  /** What they are asked to come up with. */
  prompt: string;
  /** The rule-based answer, used whenever the AI is off, busy or fails. */
  fallback: string;
  maxChars: number;
  maxTokens: number;
  /** Small talk the AI may skip when it has a backlog. */
  optional?: boolean;
}

/**
 * Decides what agents think. Returning a plain string means "decided
 * instantly"; returning a promise means the agent waits while thinking.
 */
export interface Brain {
  readonly label: string;
  think(request: ThoughtRequest): string | Promise<string>;
}

/** The free, always-available brain: agents follow built-in rules. */
export class RuleBrain implements Brain {
  readonly label = "Rules";

  think(request: ThoughtRequest): string {
    return request.fallback;
  }
}

/**
 * Turns a raw AI reply into one short line: drops reasoning blocks, labels,
 * quotes, markdown and emoji, and cuts it to `maxChars` on a word boundary.
 * Returns "" when nothing usable is left.
 */
export function cleanReply(raw: string, maxChars: number): string {
  const withoutReasoning = raw.replace(/<think>[\s\S]*?(<\/think>|$)/gi, " ");
  const firstLine =
    withoutReasoning
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? "";

  let text = firstLine
    .replace(/^(?:[-*•]|\d+[.)])\s+/, "")
    .replace(
      /^(?:project name|project|name|task|title|answer|reply)\s*:\s*/i,
      "",
    )
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/[*_`#"“”«»]/g, "")
    .replace(/^'+|'+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (text.length > maxChars) {
    const cut = text.slice(0, maxChars - 1);
    const space = cut.lastIndexOf(" ");
    text =
      (space > maxChars / 2 ? cut.slice(0, space) : cut).replace(
        /[\s,.;:!-]+$/,
        "",
      ) + "…";
  }
  return text.length >= 2 ? text : "";
}
