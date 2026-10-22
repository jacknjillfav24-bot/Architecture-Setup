import { RuleBrain, type Brain, type ThoughtRequest } from "../brain/brain";
import { DEPARTMENT_INFO, DIRECTOR_NAME } from "./org";
import { between, createRng, type Rng } from "./random";
import {
  projectThought,
  reportThought,
  startThought,
  taskThought,
} from "./thoughts";
import {
  DEPARTMENTS,
  type Agent,
  type DepartmentId,
  type Envelope,
  type LogEntry,
  type Project,
  type Role,
  type Task,
  type Vec,
} from "./types";
import {
  DIRECTOR_SEAT,
  ROOMS,
  distance,
  headSeat,
  randomPointIn,
  reportSpot,
  roomAt,
  route,
  workerSeats,
} from "./world";

const WALK_SPEED = 75;
const ENVELOPE_SPEED = 200;
const BUBBLE_SECONDS = 5;
const MAX_LOG = 80;
/** Chance that Quality sends a project back to Engineering once. */
const BUG_CHANCE = 0.35;

/** Moves `pos` along `path` by `distanceLeft`. Returns true once the path is used up. */
function advance(pos: Vec, path: Vec[], distanceLeft: number): boolean {
  let left = distanceLeft;
  while (left > 0 && path.length > 0) {
    const next = path[0];
    if (!next) break;
    const gap = distance(pos, next);
    if (gap <= left) {
      pos.x = next.x;
      pos.y = next.y;
      path.shift();
      left -= gap;
    } else {
      pos.x += ((next.x - pos.x) / gap) * left;
      pos.y += ((next.y - pos.y) / gap) * left;
      left = 0;
    }
  }
  return path.length === 0;
}

export interface SimulationOptions {
  /** Same seed, same story: used by tests. Defaults to the current time. */
  seed?: number;
  brain?: Brain;
  maxActiveProjects?: number;
}

interface Timer {
  at: number;
  run: () => void;
}

/**
 * The company. A Director starts projects; each project moves through the
 * departments in order. Department heads split the work into tasks, workers
 * do them and hand them in, and heads walk to Headquarters to report back.
 */
export class Simulation {
  time = 0;
  brain: Brain;
  readonly agents: Agent[] = [];
  readonly projects: Project[] = [];
  readonly tasks: Task[] = [];
  readonly envelopes: Envelope[] = [];
  /** Newest first. */
  readonly log: LogEntry[] = [];
  readonly stats = { projectsDone: 0, tasksDone: 0, messages: 0 };
  readonly director: Agent;

  private readonly rng: Rng;
  private readonly maxActiveProjects: number;
  private readonly timers: Timer[] = [];
  private readonly usedNames = new Set<string>();
  private nextProjectAt = 1;
  private planningProject = false;
  private nextId = 1;

  constructor(options: SimulationOptions = {}) {
    this.rng = createRng(options.seed ?? Date.now());
    this.brain = options.brain ?? new RuleBrain();
    this.maxActiveProjects = options.maxActiveProjects ?? 2;

    this.director = this.addAgent(
      DIRECTOR_NAME,
      "director",
      "Director",
      null,
      null,
      DIRECTOR_SEAT,
    );
    for (const department of DEPARTMENTS) {
      const info = DEPARTMENT_INFO[department];
      const head = this.addAgent(
        info.head,
        "head",
        `Head of ${info.name}`,
        department,
        this.director.id,
        headSeat(department),
      );
      const seats = workerSeats(department);
      info.workers.forEach((name, i) => {
        const seat = seats[i];
        if (seat)
          this.addAgent(
            name,
            "worker",
            info.workerTitle,
            department,
            head.id,
            seat,
          );
      });
    }
    this.addLog("The company opens for the day.", ROOMS.hq.color);
  }

  // ---- Lookups used by the UI and tests ----

  agentById(id: string | null): Agent | undefined {
    return this.agents.find((agent) => agent.id === id);
  }

  headOf(department: DepartmentId): Agent {
    const head = this.agents.find(
      (agent) => agent.role === "head" && agent.department === department,
    );
    if (!head) throw new Error(`No head for ${department}`);
    return head;
  }

  workersOf(department: DepartmentId): Agent[] {
    return this.agents.filter(
      (agent) => agent.role === "worker" && agent.department === department,
    );
  }

  reportsOf(manager: Agent): Agent[] {
    return this.agents.filter((agent) => agent.managerId === manager.id);
  }

  projectById(id: string): Project | undefined {
    return this.projects.find((project) => project.id === id);
  }

  taskById(id: string | null): Task | undefined {
    return this.tasks.find((task) => task.id === id);
  }

  activeProjects(): Project[] {
    return this.projects.filter((project) => project.status === "active");
  }

  /** The agent closest to a point, if one is within `radius`. */
  agentAt(point: Vec, radius = 16): Agent | null {
    let best: Agent | null = null;
    let bestDistance = radius;
    for (const agent of this.agents) {
      const d = distance(agent.pos, point);
      if (d <= bestDistance) {
        best = agent;
        bestDistance = d;
      }
    }
    return best;
  }

  // ---- Main loop ----

  update(dt: number): void {
    this.time += dt;
    this.runTimers();
    this.planProjects();
    this.assignTasks();
    this.updateWork(dt);
    for (const agent of this.agents) this.updateAgent(agent, dt);
    this.updateEnvelopes(dt);
    this.prune();
  }

  private runTimers(): void {
    const due = this.timers.filter((timer) => timer.at <= this.time);
    for (const timer of due) this.timers.splice(this.timers.indexOf(timer), 1);
    for (const timer of due) timer.run();
  }

  private updateAgent(agent: Agent, dt: number): void {
    if (agent.bubble && this.time > agent.bubble.until) agent.bubble = null;
    if (agent.path.length > 0) {
      if (advance(agent.pos, agent.path, agent.speed * dt)) {
        const arrive = agent.onArrive;
        agent.onArrive = null;
        if (arrive) arrive();
        else agent.status = this.restingStatus(agent);
      }
      return;
    }
    if (!agent.busy && !agent.thinking && this.time >= agent.nextIdleAt)
      this.idle(agent);
  }

  private updateEnvelopes(dt: number): void {
    for (const envelope of [...this.envelopes]) {
      if (advance(envelope.pos, envelope.path, ENVELOPE_SPEED * dt)) {
        this.envelopes.splice(this.envelopes.indexOf(envelope), 1);
        envelope.onArrive();
      }
    }
  }

  private updateWork(dt: number): void {
    for (const task of this.tasks) {
      if (task.status !== "working") continue;
      task.progress = Math.min(1, task.progress + dt / task.duration);
      if (task.progress >= 1) this.finishWork(task);
    }
  }

  // ---- The work flow, top to bottom ----

  private planProjects(): void {
    if (this.planningProject || this.time < this.nextProjectAt) return;
    if (this.activeProjects().length >= this.maxActiveProjects) return;
    const director = this.director;
    this.planningProject = true;
    director.status = "Dreaming up a new project";
    this.think(
      director,
      projectThought(director, this.rng, this.usedNames),
      (name) => {
        this.planningProject = false;
        this.nextProjectAt = this.time + between(this.rng, 10, 18);
        this.startProject(name);
      },
    );
  }

  private startProject(name: string): void {
    const project: Project = {
      id: this.makeId("p"),
      name,
      stage: 0,
      status: "active",
      revisions: 0,
      openTasks: 0,
      history: [],
      startedAt: this.time,
      finishedAt: null,
    };
    this.projects.push(project);
    this.usedNames.add(name);
    this.director.status = "Running the company";
    this.say(this.director, `New project: ${name}!`);
    this.addLog(
      `${this.director.name} started a new project: ${name}`,
      ROOMS.hq.color,
    );
    this.later(1.5, () => this.sendBrief(project, false));
  }

  /** The Director sends the project to the department for its current stage. */
  private sendBrief(project: Project, fix: boolean): void {
    const department = DEPARTMENTS[project.stage];
    if (!department) return;
    const head = this.headOf(department);
    project.history.push(department);
    this.stats.messages++;
    const ask = fix ? "please fix the bugs in" : "please start on";
    this.addLog(
      `${this.director.name} → ${head.name} (${DEPARTMENT_INFO[department].name}): ${ask} ${project.name}`,
      head.color,
    );
    this.sendEnvelope(this.director, head, () =>
      this.planStage(project, head, fix),
    );
  }

  /** A head splits the stage into tasks for their team. */
  private planStage(project: Project, head: Agent, fix: boolean): void {
    const department = head.department;
    if (!department) return;
    const count = fix ? 1 : 2;
    const offset = Math.floor(this.rng() * 10);
    project.openTasks = count;
    if (!head.busy) head.status = `Planning work for ${project.name}`;
    for (let slot = 0; slot < count; slot++) {
      this.think(
        head,
        taskThought(head, project.name, department, offset + slot, count, fix),
        (title) => {
          this.createTask(project, head, department, title);
          this.say(head, `New task: ${title}`);
          if (!head.busy) head.status = "Managing the team";
        },
      );
    }
  }

  private createTask(
    project: Project,
    head: Agent,
    department: DepartmentId,
    title: string,
  ): void {
    this.tasks.push({
      id: this.makeId("t"),
      projectId: project.id,
      department,
      title,
      assigneeId: null,
      status: "queued",
      progress: 0,
      duration: between(this.rng, 9, 16),
      createdAt: this.time,
    });
    this.addLog(`${head.name} planned a task: ${title}`, head.color);
  }

  /** Heads hand queued tasks to free workers in their department. */
  private assignTasks(): void {
    for (const task of this.tasks) {
      if (task.status !== "queued" || this.time < task.createdAt + 2) continue;
      const worker = this.freeWorker(task.department);
      if (!worker) continue;
      task.status = "assigned";
      task.assigneeId = worker.id;
      worker.busy = true;
      worker.taskId = task.id;
      this.say(
        this.headOf(task.department),
        `${worker.name}, this one's yours!`,
      );
      this.walkTo(
        worker,
        worker.home,
        "Going to the desk to start a task",
        () => this.startWork(worker, task),
      );
    }
  }

  private freeWorker(department: DepartmentId): Agent | undefined {
    const free = this.workersOf(department).filter((worker) => !worker.busy);
    if (free.length === 0) return undefined;
    const atDesk = free.find(
      (worker) =>
        worker.path.length === 0 && distance(worker.pos, worker.home) < 2,
    );
    return atDesk ?? free[Math.floor(this.rng() * free.length)];
  }

  private startWork(worker: Agent, task: Task): void {
    task.status = "working";
    worker.status = `Working on: ${task.title}`;
    const projectName = this.projectById(task.projectId)?.name ?? "the project";
    this.think(
      worker,
      startThought(worker, this.rng, task.title, projectName),
      (line) => this.say(worker, line),
    );
  }

  private finishWork(task: Task): void {
    const worker = this.agentById(task.assigneeId);
    if (!worker) return;
    const head = this.headOf(task.department);
    const side = this.rng() < 0.5 ? -1 : 1;
    const spot = { x: head.home.x + side * 32, y: head.home.y + 4 };
    task.status = "delivering";
    this.walkTo(worker, spot, `Bringing finished work to ${head.name}`, () =>
      this.deliver(worker, task),
    );
  }

  private deliver(worker: Agent, task: Task): void {
    const head = this.headOf(task.department);
    task.status = "done";
    worker.busy = false;
    worker.taskId = null;
    worker.status = "Just finished a task";
    worker.nextIdleAt = this.time + 1.5;
    this.stats.tasksDone++;
    this.stats.messages++;
    this.say(worker, `Done: ${task.title}`);
    this.addLog(
      `${worker.name} → ${head.name}: finished ${task.title}`,
      worker.color,
    );

    const project = this.projectById(task.projectId);
    if (!project) return;
    project.openTasks--;
    if (project.openTasks <= 0)
      this.later(1, () => this.headReport(project, head));
  }

  /** When a stage is done, the head walks to Headquarters to report. */
  private headReport(project: Project, head: Agent): void {
    const department = head.department;
    if (!department) return;
    if (head.busy) {
      // Already on the way to report on another project: try again shortly.
      this.later(2, () => this.headReport(project, head));
      return;
    }
    const fix =
      department === "quality" &&
      project.revisions === 0 &&
      this.rng() < BUG_CHANCE;
    head.busy = true;
    head.status = "Writing a report for the Director";
    this.think(
      head,
      reportThought(head, this.rng, project.name, department, fix),
      (text) => {
        this.walkTo(
          head,
          reportSpot(department),
          `Walking to Headquarters to report on ${project.name}`,
          () => {
            head.status = "Reporting to the Director";
            this.say(head, text);
            this.stats.messages++;
            this.addLog(
              `${head.name} → ${this.director.name}: ${text}`,
              head.color,
            );
            this.later(1.5, () => this.directorDecides(project, fix));
            this.later(2.5, () => {
              head.busy = false;
              head.nextIdleAt = this.time;
            });
          },
        );
      },
    );
  }

  private directorDecides(project: Project, fix: boolean): void {
    const director = this.director;
    if (fix) {
      project.revisions++;
      project.stage = DEPARTMENTS.indexOf("engineering");
      this.say(director, `Engineering, please fix ${project.name}.`);
      this.later(1.5, () => this.sendBrief(project, true));
      return;
    }
    if (project.stage >= DEPARTMENTS.length - 1) {
      project.status = "done";
      project.finishedAt = this.time;
      this.stats.projectsDone++;
      this.say(director, `${project.name} is finished. Great work, everyone!`);
      this.addLog(`Project finished: ${project.name}`, ROOMS.archive.color);
      this.nextProjectAt = Math.min(this.nextProjectAt, this.time + 4);
      return;
    }
    project.stage++;
    const next = DEPARTMENTS[project.stage];
    if (!next) return;
    this.say(director, `Thanks! ${DEPARTMENT_INFO[next].name}, you're up.`);
    this.later(1.5, () => this.sendBrief(project, false));
  }

  // ---- Everyday behaviour ----

  private idle(agent: Agent): void {
    if (distance(agent.pos, agent.home) >= 2) {
      this.walkTo(agent, agent.home, "Heading back to the desk");
      agent.nextIdleAt = this.time + between(this.rng, 4, 10);
      return;
    }
    const roll = this.rng();
    if (agent.role === "worker" && roll < 0.15) {
      this.walkTo(
        agent,
        randomPointIn(ROOMS.lounge, this.rng),
        "Going for a coffee",
        () => {
          agent.status = "Having a coffee";
          agent.nextIdleAt = this.time + between(this.rng, 4, 9);
        },
      );
    } else if (agent.role !== "director" && roll < 0.4) {
      const room = ROOMS[agent.department ?? "hq"];
      this.walkTo(
        agent,
        randomPointIn(room, this.rng),
        "Taking a short walk",
        () => {
          agent.status = "Thinking things over";
          agent.nextIdleAt = this.time + between(this.rng, 2, 5);
        },
      );
    } else {
      agent.nextIdleAt = this.time + between(this.rng, 4, 10);
    }
  }

  private restingStatus(agent: Agent): string {
    if (distance(agent.pos, agent.home) < 2) {
      if (agent.role === "director") return "Running the company";
      if (agent.role === "head") return "Managing the team";
      return "At the desk, ready for work";
    }
    return roomAt(agent.pos)?.id === "lounge"
      ? "Having a coffee"
      : "Taking a short walk";
  }

  // ---- Helpers ----

  /**
   * Asks the brain. Each agent thinks about one thing at a time; the rules
   * brain answers instantly, the AI brain makes the agent wait.
   */
  private think(
    agent: Agent,
    request: ThoughtRequest,
    then: (text: string) => void,
  ): void {
    agent.thoughtQueue.push({ request, then });
    this.pumpThoughts(agent);
  }

  private pumpThoughts(agent: Agent): void {
    while (!agent.thinking) {
      const next = agent.thoughtQueue.shift();
      if (!next) return;
      let reply: string | Promise<string>;
      try {
        reply = this.brain.think(next.request);
      } catch {
        reply = next.request.fallback;
      }
      if (typeof reply === "string") {
        this.remember(agent, reply);
        next.then(reply);
        continue;
      }
      agent.thinking = true;
      void reply
        .catch(() => next.request.fallback)
        .then((text) => {
          agent.thinking = false;
          this.remember(agent, text);
          next.then(text);
          this.pumpThoughts(agent);
        });
    }
  }

  private walkTo(
    agent: Agent,
    target: Vec,
    status: string,
    onArrive?: () => void,
  ): void {
    agent.path = route(agent.pos, target);
    agent.status = status;
    agent.onArrive = onArrive ?? null;
  }

  private sendEnvelope(from: Agent, to: Agent, onArrive: () => void): void {
    const pos = { ...from.pos };
    this.envelopes.push({
      id: this.makeId("e"),
      color: to.color,
      pos,
      path: route(pos, to.home),
      onArrive,
    });
  }

  private say(agent: Agent, text: string): void {
    agent.bubble = { text, until: this.time + BUBBLE_SECONDS };
  }

  private remember(agent: Agent, text: string): void {
    agent.memory.unshift(text);
    agent.memory.length = Math.min(agent.memory.length, 6);
  }

  private later(delay: number, run: () => void): void {
    this.timers.push({ at: this.time + delay, run });
  }

  private addLog(text: string, color: string): void {
    this.log.unshift({ id: this.nextId++, time: this.time, text, color });
    this.log.length = Math.min(this.log.length, MAX_LOG);
  }

  private makeId(prefix: string): string {
    return `${prefix}${this.nextId++}`;
  }

  private addAgent(
    name: string,
    role: Role,
    title: string,
    department: DepartmentId | null,
    managerId: string | null,
    home: Vec,
  ): Agent {
    const agent: Agent = {
      id: this.makeId("a"),
      name,
      role,
      title,
      department,
      managerId,
      color: ROOMS[department ?? "hq"].color,
      home: { ...home },
      pos: { ...home },
      path: [],
      speed: WALK_SPEED * between(this.rng, 0.85, 1.15),
      onArrive: null,
      busy: false,
      status:
        role === "director"
          ? "Running the company"
          : "At the desk, ready for work",
      taskId: null,
      thinking: false,
      thoughtQueue: [],
      bubble: null,
      memory: [],
      nextIdleAt: between(this.rng, 1, 6),
    };
    this.agents.push(agent);
    return agent;
  }

  /** Keeps memory use flat when the world runs for hours. */
  private prune(): void {
    if (this.tasks.length > 200) {
      const open = this.tasks.filter((task) => task.status !== "done");
      const done = this.tasks
        .filter((task) => task.status === "done")
        .slice(-100);
      this.tasks.splice(0, this.tasks.length, ...open, ...done);
    }
    if (this.projects.length > 40) {
      const active = this.activeProjects();
      const done = this.projects
        .filter((project) => project.status === "done")
        .slice(-20);
      this.projects.splice(0, this.projects.length, ...active, ...done);
    }
  }
}
