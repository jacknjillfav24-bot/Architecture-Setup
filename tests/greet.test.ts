import { describe, expect, it } from "vitest";
import { greet } from "../src/lib/greet.js";

describe("greet", () => {
  it("greets by name", () => {
    expect(greet("world")).toBe("Hello, world!");
  });
});
