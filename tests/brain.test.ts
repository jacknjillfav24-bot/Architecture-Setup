import { describe, expect, it } from "vitest";
import { AIBrain, type ChatEngine } from "../src/brain/aiBrain";
import { cleanReply, type ThoughtRequest } from "../src/brain/brain";

describe("cleanReply", () => {
  it("keeps a plain answer as it is", () => {
    expect(cleanReply("Recipe Planner", 40)).toBe("Recipe Planner");
  });

  it("strips labels, quotes, markdown and emoji", () => {
    expect(cleanReply('Project name: **"Sunny Day Planner"** 🌞', 40)).toBe(
      "Sunny Day Planner",
    );
    expect(cleanReply("- Sketch the main screens", 40)).toBe(
      "Sketch the main screens",
    );
  });

  it("keeps only the first line and drops reasoning blocks", () => {
    expect(
      cleanReply(
        "<think>hmm, let me see</think>\n\nBuild the login page\nBecause users need it",
        40,
      ),
    ).toBe("Build the login page");
  });

  it("does not eat names that start with a number", () => {
    expect(cleanReply("3D Print Hub", 40)).toBe("3D Print Hub");
  });

  it("shortens long replies on a word boundary", () => {
    const text = cleanReply(
      "We finished every single part of the research for the new app today",
      30,
    );
    expect(text.length).toBeLessThanOrEqual(30);
    expect(text.endsWith("…")).toBe(true);
    expect(text).not.toMatch(/\s…$/);
  });

  it("returns nothing for empty replies", () => {
    expect(cleanReply("   \n  ", 40)).toBe("");
    expect(cleanReply('""', 40)).toBe("");
  });
});

describe("AIBrain", () => {
  const request = (
    overrides: Partial<ThoughtRequest> = {},
  ): ThoughtRequest => ({
    persona: "You are a tester.",
    prompt: "Say something.",
    fallback: "Rule answer",
    maxChars: 40,
    maxTokens: 20,
    ...overrides,
  });

  it("uses the AI's cleaned-up answer", async () => {
    const engine: ChatEngine = {
      complete: () => Promise.resolve('"Hello team!"'),
    };
    const brain = new AIBrain(engine, "Test AI");
    expect(await brain.think(request())).toBe("Hello team!");
    expect(brain.answered).toBe(1);
  });

  it("falls back to the rules when the AI fails or times out", async () => {
    const failing = new AIBrain(
      { complete: () => Promise.reject(new Error("GPU lost")) },
      "Test AI",
    );
    expect(await failing.think(request())).toBe("Rule answer");
    expect(failing.failures).toBe(1);

    const stuck = new AIBrain(
      { complete: () => new Promise<string>(() => {}) },
      "Test AI",
      10,
    );
    expect(await stuck.think(request())).toBe("Rule answer");
  });

  it("answers one request at a time, in order", async () => {
    const seen: string[] = [];
    const engine: ChatEngine = {
      complete: async (_system, prompt) => {
        seen.push(`start ${prompt}`);
        await new Promise((resolve) => setTimeout(resolve, 5));
        seen.push(`end ${prompt}`);
        return prompt;
      },
    };
    const brain = new AIBrain(engine, "Test AI");
    const answers = await Promise.all([
      brain.think(request({ prompt: "alpha" })),
      brain.think(request({ prompt: "beta" })),
    ]);
    expect(answers).toEqual(["alpha", "beta"]);
    expect(seen).toEqual([
      "start alpha",
      "end alpha",
      "start beta",
      "end beta",
    ]);
  });

  it("skips small talk when the AI already has a backlog", async () => {
    const engine: ChatEngine = {
      complete: () =>
        new Promise((resolve) => setTimeout(() => resolve("AI answer"), 5)),
    };
    const brain = new AIBrain(engine, "Test AI");
    const first = brain.think(request());
    const second = brain.think(request());
    expect(brain.think(request({ optional: true }))).toBe("Rule answer");
    await Promise.all([first, second]);
  });
});
