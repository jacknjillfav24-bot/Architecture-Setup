import { DEPARTMENT_INFO } from "../sim/org";
import type { Simulation } from "../sim/simulation";
import { DEPARTMENTS, type Agent, type Project } from "../sim/types";
import { ROOMS } from "../sim/world";

export interface PanelElements {
  stats: HTMLElement;
  projects: HTMLElement;
  inspector: HTMLElement;
  log: HTMLElement;
}

/** Creates an element. Text is always set with textContent, so AI replies can't inject HTML. */
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function withColor<T extends HTMLElement>(element: T, color: string): T {
  element.style.setProperty("--c", color);
  return element;
}

export function formatTime(seconds: number): string {
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

/** The side panel: company numbers, projects, the selected agent and the activity log. */
export class Panel {
  private readonly ui: PanelElements;
  private lastLogId = -1;

  constructor(ui: PanelElements) {
    this.ui = ui;
  }

  reset(): void {
    this.lastLogId = -1;
  }

  update(sim: Simulation, selected: Agent | null): void {
    this.renderStats(sim);
    this.renderProjects(sim);
    this.renderInspector(sim, selected);
    this.renderLog(sim);
  }

  private renderStats(sim: Simulation): void {
    const tiles: [string, number][] = [
      ["Agents", sim.agents.length],
      ["Projects finished", sim.stats.projectsDone],
      ["Tasks done", sim.stats.tasksDone],
      ["Messages sent", sim.stats.messages],
    ];
    this.ui.stats.replaceChildren(
      ...tiles.map(([label, value]) => {
        const tile = el("div", "stat");
        tile.append(
          el("b", undefined, String(value)),
          el("span", undefined, label),
        );
        return tile;
      }),
    );
  }

  private renderProjects(sim: Simulation): void {
    const active = sim.activeProjects();
    const done = sim.projects
      .filter((p) => p.status === "done")
      .slice(-3)
      .reverse();
    if (active.length === 0 && done.length === 0) {
      this.ui.projects.replaceChildren(
        el("li", "muted", "The Director is thinking of the first project…"),
      );
      return;
    }
    this.ui.projects.replaceChildren(
      ...active.map((p) => this.activeProject(p)),
      ...done.map((p) => this.doneProject(p)),
    );
  }

  private activeProject(project: Project): HTMLLIElement {
    const item = el("li");
    item.append(el("div", "project-name", project.name));
    const current = DEPARTMENTS[project.stage];
    const note =
      project.revisions > 0 && current === "engineering"
        ? "Back in Engineering to fix bugs Quality found"
        : `Now with ${current ? DEPARTMENT_INFO[current].name : "the team"}`;
    item.append(el("div", "project-note", note));
    const chips = el("div", "chips");
    DEPARTMENTS.forEach((department, index) => {
      const state =
        index < project.stage
          ? "done"
          : index === project.stage
            ? "current"
            : "";
      const label = `${state === "done" ? "✓ " : ""}${DEPARTMENT_INFO[department].name}`;
      chips.append(
        withColor(el("span", `chip ${state}`, label), ROOMS[department].color),
      );
    });
    item.append(chips);
    return item;
  }

  private doneProject(project: Project): HTMLLIElement {
    const item = el("li");
    item.append(el("div", "project-name", `✓ ${project.name}`));
    const took = (project.finishedAt ?? project.startedAt) - project.startedAt;
    const fixes = project.revisions > 0 ? ", after one bug fix round" : "";
    item.append(
      el("div", "project-note", `Finished in ${formatTime(took)}${fixes}`),
    );
    return item;
  }

  private renderInspector(sim: Simulation, agent: Agent | null): void {
    if (!agent) {
      this.ui.inspector.replaceChildren(
        el(
          "p",
          "muted",
          "Click any agent in the world, or pick one above, to see who they are and what they're doing.",
        ),
      );
      return;
    }

    const head = el("div", "agent-head");
    const name = el("div");
    name.append(
      el("strong", undefined, agent.name),
      el("small", undefined, agent.title),
    );
    head.append(withColor(el("span", "dot"), agent.color), name);

    const facts = el("dl");
    const add = (label: string, value: string) =>
      facts.append(el("dt", undefined, label), el("dd", undefined, value));
    add(
      "Department",
      agent.department
        ? DEPARTMENT_INFO[agent.department].name
        : "Headquarters",
    );
    add(
      "Reports to",
      sim.agentById(agent.managerId)?.name ?? "Nobody: they run the company",
    );
    const reports = sim.reportsOf(agent);
    if (reports.length > 0)
      add("Manages", reports.map((a) => a.name).join(", "));
    add("Doing now", agent.thinking ? "Thinking…" : agent.status);
    const task = sim.taskById(agent.taskId);
    if (task) {
      const project = sim.projectById(task.projectId);
      add("Task", `${task.title} (${Math.round(task.progress * 100)}%)`);
      if (project) add("Project", project.name);
    }

    const children: HTMLElement[] = [head, facts];
    if (agent.memory.length > 0) {
      children.push(el("p", "note", `Recent thoughts (${sim.brain.label})`));
      const list = el("ul", "thoughts");
      for (const thought of agent.memory)
        list.append(el("li", undefined, thought));
      children.push(list);
    }
    this.ui.inspector.replaceChildren(...children);
  }

  private renderLog(sim: Simulation): void {
    const newest = sim.log[0];
    if (!newest || newest.id === this.lastLogId) return;
    this.lastLogId = newest.id;
    this.ui.log.replaceChildren(
      ...sim.log.slice(0, 50).map((entry) => {
        const item = withColor(el("li"), entry.color);
        item.append(
          el("time", undefined, formatTime(entry.time)),
          el("span", undefined, entry.text),
        );
        return item;
      }),
    );
  }
}
