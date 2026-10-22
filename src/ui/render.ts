import type { Simulation } from "../sim/simulation";
import { DEPARTMENTS, type Agent, type Vec } from "../sim/types";
import {
  CORRIDOR,
  DIRECTOR_SEAT,
  ROOMS,
  ROOM_LIST,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  headSeat,
  workerSeats,
  type Room,
} from "../sim/world";

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const INK = "#2d3039";
const WALL = "#4a4e5a";
const GOLD = "#e0a823";
const DOOR_WIDTH = 46;

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function tint(hex: string, alpha: number): string {
  const [r, g, b] = rgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function shade(hex: string, amount: number): string {
  const [r, g, b] = rgb(hex).map((c) => Math.round(c * (1 - amount)));
  return `rgb(${r}, ${g}, ${b})`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Draws the world onto a canvas. Coordinates are in world units (1000 × 660). */
export class Renderer {
  showHierarchy = false;
  selectedId: string | null = null;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D is not supported");
    this.canvas = canvas;
    this.ctx = ctx;
    this.resize();
  }

  /** Matches the canvas resolution to its on-screen size for crisp drawing. */
  resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const width = this.canvas.clientWidth || WORLD_WIDTH;
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(
      ((width * WORLD_HEIGHT) / WORLD_WIDTH) * dpr,
    );
  }

  toWorld(clientX: number, clientY: number): Vec {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * WORLD_WIDTH,
      y: ((clientY - rect.top) / rect.height) * WORLD_HEIGHT,
    };
  }

  draw(sim: Simulation, clock: number): void {
    const { ctx } = this;
    ctx.setTransform(
      this.canvas.width / WORLD_WIDTH,
      0,
      0,
      this.canvas.height / WORLD_HEIGHT,
      0,
      0,
    );
    this.drawFloor();
    for (const room of ROOM_LIST) this.drawRoom(room);
    this.drawFurniture(sim);
    if (this.showHierarchy) this.drawHierarchy(sim);
    for (const envelope of sim.envelopes)
      this.drawEnvelope(envelope.pos, envelope.color);
    const agents = [...sim.agents].sort((a, b) => a.pos.y - b.pos.y);
    for (const agent of agents) this.drawAgent(sim, agent, clock);
    for (const agent of agents) this.drawBubble(sim, agent, clock);
  }

  private drawFloor(): void {
    const { ctx } = this;
    ctx.fillStyle = "#d9d2c3";
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    ctx.fillStyle = "#efe8db";
    ctx.fillRect(
      20,
      CORRIDOR.top,
      WORLD_WIDTH - 40,
      CORRIDOR.bottom - CORRIDOR.top,
    );
    ctx.strokeStyle = "rgba(0, 0, 0, 0.08)";
    ctx.lineWidth = 2;
    ctx.setLineDash([12, 12]);
    ctx.beginPath();
    ctx.moveTo(90, CORRIDOR.y);
    ctx.lineTo(WORLD_WIDTH - 30, CORRIDOR.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#8a8578";
    ctx.font = `600 11px ${FONT}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("HALLWAY", 30, CORRIDOR.y);
  }

  private drawRoom(room: Room): void {
    const { ctx } = this;
    const { x, y, w, h } = room.rect;
    ctx.fillStyle = "#fbf8f3";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = tint(room.color, 0.1);
    ctx.fillRect(x, y, w, h);

    // Floor tiles.
    ctx.strokeStyle = tint(room.color, 0.08);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let gx = x + 25; gx < x + w; gx += 25) {
      ctx.moveTo(gx, y);
      ctx.lineTo(gx, y + h);
    }
    for (let gy = y + 25; gy < y + h; gy += 25) {
      ctx.moveTo(x, gy);
      ctx.lineTo(x + w, gy);
    }
    ctx.stroke();

    // Walls, with a doorway on the side facing the hallway.
    const doorOnTop = room.door.y === y;
    const left = room.door.x - DOOR_WIDTH / 2;
    const right = room.door.x + DOOR_WIDTH / 2;
    ctx.strokeStyle = WALL;
    ctx.lineWidth = 6;
    ctx.lineCap = "square";
    ctx.beginPath();
    const edge = (edgeY: number, hasDoor: boolean) => {
      ctx.moveTo(x, edgeY);
      if (hasDoor) {
        ctx.lineTo(left, edgeY);
        ctx.moveTo(right, edgeY);
      }
      ctx.lineTo(x + w, edgeY);
    };
    edge(y, doorOnTop);
    edge(y + h, !doorOnTop);
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + h);
    ctx.moveTo(x + w, y);
    ctx.lineTo(x + w, y + h);
    ctx.stroke();
    ctx.lineCap = "butt";

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = shade(room.color, 0.25);
    ctx.font = `700 15px ${FONT}`;
    ctx.fillText(room.name, x + 14, y + 26);
    ctx.fillStyle = "#6b6f7a";
    ctx.font = `12px ${FONT}`;
    ctx.fillText(room.subtitle, x + 14, y + 42);
  }

  private drawFurniture(sim: Simulation): void {
    const { ctx } = this;

    // Headquarters: a rug, the Director's desk and two plants.
    ctx.fillStyle = tint(ROOMS.hq.color, 0.14);
    ctx.beginPath();
    ctx.ellipse(
      DIRECTOR_SEAT.x,
      DIRECTOR_SEAT.y + 10,
      120,
      48,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    this.drawDesk(DIRECTOR_SEAT, 80, 26);
    this.drawPlant({ x: 370, y: 160 });
    this.drawPlant({ x: 630, y: 160 });

    // Departments: desks and a task board.
    for (const department of DEPARTMENTS) {
      this.drawDesk(headSeat(department), 64, 24);
      for (const seat of workerSeats(department)) this.drawDesk(seat, 48, 22);
      this.drawTaskBoard(sim, ROOMS[department]);
    }

    // Lounge: sofa, coffee table, round table and coffee machine.
    ctx.fillStyle = "#8f6f4e";
    ctx.beginPath();
    ctx.roundRect(34, 126, 112, 36, 8);
    ctx.fill();
    ctx.fillStyle = "#a9875f";
    ctx.beginPath();
    ctx.roundRect(40, 132, 100, 18, 5);
    ctx.fill();
    ctx.fillStyle = "#c79c6e";
    ctx.beginPath();
    ctx.roundRect(56, 88, 70, 24, 5);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(236, 118, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#3a3f4b";
    ctx.beginPath();
    ctx.roundRect(276, 56, 28, 32, 4);
    ctx.fill();
    ctx.fillStyle = "#e05d4f";
    ctx.beginPath();
    ctx.arc(290, 66, 3, 0, Math.PI * 2);
    ctx.fill();
    this.drawPlant({ x: 300, y: 166 });

    // Archive: shelves holding one box per finished project.
    const shelf = ROOMS.archive.rect;
    const perShelf = 14;
    ctx.textAlign = "right";
    ctx.fillStyle = "#6b6f7a";
    ctx.font = `600 12px ${FONT}`;
    ctx.fillText(
      `${sim.stats.projectsDone} finished`,
      shelf.x + shelf.w - 14,
      shelf.y + 26,
    );
    ctx.textAlign = "left";
    [92, 128, 164].forEach((shelfY, row) => {
      ctx.fillStyle = "#8b6b4a";
      ctx.fillRect(shelf.x + 20, shelfY, shelf.w - 40, 6);
      for (let i = 0; i < perShelf; i++) {
        const index = row * perShelf + i;
        if (index >= sim.stats.projectsDone) return;
        const color =
          ROOMS[DEPARTMENTS[index % DEPARTMENTS.length] ?? "research"].color;
        ctx.fillStyle = tint(color, 0.75);
        ctx.fillRect(shelf.x + 26 + i * 18, shelfY - 13, 14, 13);
      }
    });
  }

  private drawDesk(seat: Vec, w: number, h: number): void {
    const { ctx } = this;
    const top = seat.y - 20 - h / 2;
    ctx.fillStyle = "#c79c6e";
    ctx.beginPath();
    ctx.roundRect(seat.x - w / 2, top, w, h, 4);
    ctx.fill();
    ctx.fillStyle = "#a97f55";
    ctx.fillRect(seat.x - w / 2 + 2, top + h - 4, w - 4, 4);
    ctx.fillStyle = "#2f3440";
    ctx.fillRect(seat.x - 9, top + 3, 18, 10);
    ctx.fillStyle = "#6fb3e8";
    ctx.fillRect(seat.x - 7, top + 5, 14, 6);
  }

  private drawPlant(at: Vec): void {
    const { ctx } = this;
    ctx.fillStyle = "#9c6b45";
    ctx.beginPath();
    ctx.arc(at.x, at.y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#4f9a5b";
    for (const [dx, dy] of [
      [-5, -4],
      [5, -4],
      [0, -9],
      [0, 0],
    ] as const) {
      ctx.beginPath();
      ctx.arc(at.x + dx, at.y + dy - 2, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** One sticky note per open task: yellow waiting, green in progress, blue being handed in. */
  private drawTaskBoard(sim: Simulation, room: Room): void {
    const { ctx } = this;
    // Right of the head's desk, below the room's name and description.
    const bx = room.rect.x + room.rect.w - 64;
    const by = room.rect.y + 56;
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#b9b4a8";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(bx, by, 52, 36, 3);
    ctx.fill();
    ctx.stroke();
    const open = sim.tasks.filter(
      (task) => task.department === room.id && task.status !== "done",
    );
    open.slice(0, 8).forEach((task, i) => {
      ctx.fillStyle =
        task.status === "queued"
          ? "#ffd866"
          : task.status === "delivering"
            ? "#8cc4f2"
            : "#93d39a";
      ctx.fillRect(
        bx + 4 + (i % 4) * 12,
        by + 5 + Math.floor(i / 4) * 15,
        9,
        11,
      );
    });
  }

  private drawHierarchy(sim: Simulation): void {
    const { ctx } = this;
    ctx.save();
    ctx.lineWidth = 1.6;
    ctx.setLineDash([5, 4]);
    for (const agent of sim.agents) {
      const manager = sim.agentById(agent.managerId);
      if (!manager) continue;
      ctx.strokeStyle = tint(agent.color, 0.7);
      ctx.beginPath();
      ctx.moveTo(agent.pos.x, agent.pos.y);
      ctx.lineTo(manager.pos.x, manager.pos.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawEnvelope(pos: Vec, color: string): void {
    const { ctx } = this;
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.roundRect(-9, -6, 18, 12, 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-9, -6);
    ctx.lineTo(0, 1);
    ctx.lineTo(9, -6);
    ctx.stroke();
    ctx.restore();
  }

  private drawAgent(sim: Simulation, agent: Agent, clock: number): void {
    const { ctx } = this;
    const walking = agent.path.length > 0;
    const x = agent.pos.x;
    const y =
      agent.pos.y +
      (walking ? Math.sin(clock * 12 + agent.pos.x / 7) * 1.3 : 0);

    ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
    ctx.beginPath();
    ctx.ellipse(agent.pos.x, agent.pos.y + 10, 9, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();

    if (agent.id === this.selectedId) {
      ctx.save();
      ctx.strokeStyle = "#1f6feb";
      ctx.lineWidth = 2.5;
      ctx.setLineDash([4, 3]);
      ctx.lineDashOffset = -clock * 12;
      ctx.beginPath();
      ctx.arc(x, y, 16, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.fillStyle = agent.color;
    ctx.strokeStyle = shade(agent.color, 0.35);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    if (agent.role === "head") {
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 12.5, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (agent.role === "director") this.drawStar(x, y - 17, 7);

    ctx.fillStyle = "#ffffff";
    ctx.font = `700 10px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(agent.name.charAt(0), x, y + 0.5);

    ctx.font = `600 11px ${FONT}`;
    ctx.textBaseline = "top";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
    ctx.strokeText(agent.name, x, y + 14);
    ctx.fillStyle = INK;
    ctx.fillText(agent.name, x, y + 14);

    const task = sim.taskById(agent.taskId);
    if (task?.status === "working") {
      ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
      ctx.fillRect(x - 14, y - 22, 28, 5);
      ctx.fillStyle = shade(agent.color, 0.1);
      ctx.fillRect(x - 14, y - 22, 28 * task.progress, 5);
    }
  }

  private drawStar(cx: number, cy: number, r: number): void {
    const { ctx } = this;
    ctx.fillStyle = GOLD;
    ctx.strokeStyle = shade(GOLD, 0.35);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const radius = i % 2 === 0 ? r : r * 0.45;
      const angle = -Math.PI / 2 + (i * Math.PI) / 5;
      ctx.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  private drawBubble(sim: Simulation, agent: Agent, clock: number): void {
    const { ctx } = this;
    let text: string;
    let alpha = 1;
    if (agent.thinking) {
      text = `thinking${".".repeat(1 + (Math.floor(clock * 3) % 3))}`;
    } else if (agent.bubble) {
      text = agent.bubble.text;
      alpha = clamp((agent.bubble.until - sim.time) / 0.6, 0, 1);
    } else {
      return;
    }

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = `12px ${FONT}`;
    const lines = this.wrap(text, 150, 2);
    const pad = 6;
    const lineHeight = 15;
    const width =
      Math.max(...lines.map((line) => ctx.measureText(line).width)) + pad * 2;
    const height = lines.length * lineHeight + pad * 2 - 2;
    const working = sim.taskById(agent.taskId)?.status === "working";
    const raised = working || agent.role === "director" ? 30 : 20;
    const bottom = agent.pos.y - raised - 5;
    const top = bottom - height;
    const left = clamp(agent.pos.x - width / 2, 4, WORLD_WIDTH - width - 4);
    const tailX = clamp(agent.pos.x, left + 9, left + width - 9);

    ctx.fillStyle = agent.thinking ? "#f3f0ff" : "#ffffff";
    ctx.strokeStyle = agent.color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(left, top, width, height, 7);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(tailX - 5, bottom - 1);
    ctx.lineTo(tailX, bottom + 6);
    ctx.lineTo(tailX + 5, bottom - 1);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(tailX - 5, bottom);
    ctx.lineTo(tailX, bottom + 6);
    ctx.lineTo(tailX + 5, bottom);
    ctx.stroke();

    ctx.fillStyle = agent.thinking ? "#5b4a9e" : INK;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    lines.forEach((line, i) =>
      ctx.fillText(line, left + pad, top + pad + i * lineHeight),
    );
    ctx.restore();
  }

  private wrap(text: string, maxWidth: number, maxLines: number): string[] {
    const { ctx } = this;
    const lines: string[] = [];
    let line = "";
    for (const word of text.split(" ")) {
      const candidate = line ? `${line} ${word}` : word;
      if (!line || ctx.measureText(candidate).width <= maxWidth) {
        line = candidate;
      } else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
    if (lines.length <= maxLines) return lines;
    const kept = lines.slice(0, maxLines);
    let last = kept[maxLines - 1] ?? "";
    while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth)
      last = last.slice(0, -1);
    kept[maxLines - 1] = `${last.trimEnd()}…`;
    return kept;
  }
}
