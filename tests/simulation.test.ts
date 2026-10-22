import { describe, expect, it } from "vitest";
import type { Brain, ThoughtRequest } from "../src/brain/brain";
import { Simulation } from "../src/sim/simulation";
import { DEPARTMENTS } from "../src/sim/types";

function run(sim: Simulation, seconds: number, step = 0.05): void {
  for (let t = 0; t < seconds; t += step) sim.update(step);
}

describe("organisation", () => {
  const sim = new Simulation({ seed: 1 });

  it("has one Director, a head per department and three workers each", () => {
    expect(sim.agents.filter((a) => a.role === "director")).toHaveLength(1);
    for (const department of DEPARTMENTS) {
      expect(sim.headOf(department).department).toBe(department);
      expect(sim.workersOf(department)).toHaveLength(3);
    }
  });

  it("forms a hierarchy: workers report to their head, heads to the Director", () => {
    expect(sim.director.managerId).toBeNull();
    for (const department of DEPARTMENTS) {
      const head = sim.headOf(department);
      expect(head.managerId).toBe(sim.director.id);
      for (const worker of sim.workersOf(department))
        expect(worker.managerId).toBe(head.id);
    }
    expect(sim.reportsOf(sim.director)).toHaveLength(DEPARTMENTS.length);
  });
});

describe("work flow", () => {
  it("finishes projects by passing them through every department in order", () => {
    const sim = new Simulation({ seed: 7 });
    run(sim, 900);

    const done = sim.projects.filter((p) => p.status === "done");
    expect(done.length).toBeGreaterThanOrEqual(2);
    expect(sim.stats.projectsDone).toBe(done.length);
    for (const project of done) {
      expect(project.history.slice(0, 4)).toEqual([...DEPARTMENTS]);
      // A bug fix round goes back to Engineering, then Quality checks again.
      if (project.revisions > 0)
        expect(project.history.slice(4)).toEqual(["engineering", "quality"]);
      else expect(project.history).toHaveLength(4);
    }
  });

  it("only gives tasks to workers of the right department", () => {
    const sim = new Simulation({ seed: 3 });
    run(sim, 400);
    const assigned = sim.tasks.filter((t) => t.assigneeId);
    expect(assigned.length).toBeGreaterThan(0);
    for (const task of assigned) {
      const worker = sim.agentById(task.assigneeId);
      expect(worker?.role).toBe("worker");
      expect(worker?.department).toBe(task.department);
    }
  });

  it("never has a worker on two tasks at once", () => {
    const sim = new Simulation({ seed: 11 });
    for (let i = 0; i < 6000; i++) {
      sim.update(0.05);
      const open = sim.tasks.filter((t) => t.assigneeId && t.status !== "done");
      const owners = open.map((t) => t.assigneeId);
      expect(new Set(owners).size).toBe(owners.length);
    }
  });

  it("tells the same story for the same seed", () => {
    const a = new Simulation({ seed: 42 });
    const b = new Simulation({ seed: 42 });
    run(a, 200);
    run(b, 200);
    expect(a.log.map((e) => e.text)).toEqual(b.log.map((e) => e.text));
  });
});

describe("thinking with a slow brain", () => {
  /** Answers after a short delay, like an AI model would. */
  class SlowBrain implements Brain {
    readonly label = "Slow";
    asked = 0;
    think(request: ThoughtRequest): Promise<string> {
      this.asked++;
      return new Promise((resolve) =>
        setTimeout(() => resolve(`AI: ${request.fallback}`), 1),
      );
    }
  }

  it("keeps the world moving while agents wait for answers", async () => {
    const brain = new SlowBrain();
    const sim = new Simulation({ seed: 5, brain });
    for (let i = 0; i < 9000; i++) {
      sim.update(0.05);
      if (i % 20 === 0) await new Promise((resolve) => setTimeout(resolve, 2));
    }
    expect(brain.asked).toBeGreaterThan(10);
    expect(sim.stats.projectsDone).toBeGreaterThanOrEqual(1);
    expect(sim.projects[0]?.name.startsWith("AI: ")).toBe(true);
  });
});
