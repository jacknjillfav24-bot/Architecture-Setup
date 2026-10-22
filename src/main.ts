import "./style.css";
import { RuleBrain, type Brain } from "./brain/brain";
import { Simulation } from "./sim/simulation";
import { setupAIControls } from "./ui/aiControls";
import { Panel } from "./ui/panel";
import { Renderer } from "./ui/render";

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing #${id}`);
  return element as T;
}

let brain: Brain = new RuleBrain();
let sim = new Simulation({ brain });
let speed = 1;
let paused = false;
let selectedId: string | null = null;

const canvas = byId<HTMLCanvasElement>("world");
const renderer = new Renderer(canvas);
const panel = new Panel({
  stats: byId("stats"),
  projects: byId("projects"),
  inspector: byId("inspector"),
  log: byId("log"),
});
new ResizeObserver(() => renderer.resize()).observe(canvas);

// ---- Selecting an agent ----

const picker = byId<HTMLSelectElement>("agent-picker");

function fillPicker(): void {
  const none = new Option("Choose an agent…", "");
  picker.replaceChildren(
    none,
    ...sim.agents.map(
      (agent) => new Option(`${agent.name}, ${agent.title}`, agent.id),
    ),
  );
}

function select(id: string | null): void {
  selectedId = id;
  renderer.selectedId = id;
  picker.value = id ?? "";
  panel.update(sim, sim.agentById(id) ?? null);
}

canvas.addEventListener("click", (event) => {
  select(
    sim.agentAt(renderer.toWorld(event.clientX, event.clientY), 18)?.id ?? null,
  );
});
picker.addEventListener("change", () => select(picker.value || null));

// ---- Controls ----

const pauseButton = byId<HTMLButtonElement>("pause");
pauseButton.addEventListener("click", () => {
  paused = !paused;
  pauseButton.textContent = paused ? "Resume" : "Pause";
  pauseButton.setAttribute("aria-pressed", String(paused));
});

const speedButtons =
  document.querySelectorAll<HTMLButtonElement>("[data-speed]");
for (const button of speedButtons) {
  button.addEventListener("click", () => {
    speed = Number(button.dataset.speed) || 1;
    for (const other of speedButtons)
      other.setAttribute("aria-pressed", String(other === button));
  });
}

const hierarchy = byId<HTMLInputElement>("hierarchy");
hierarchy.addEventListener("change", () => {
  renderer.showHierarchy = hierarchy.checked;
});

byId<HTMLButtonElement>("reset").addEventListener("click", () => {
  sim = new Simulation({ brain });
  panel.reset();
  fillPicker();
  select(null);
});

setupAIControls(
  {
    status: byId("ai-status"),
    setup: byId("ai-setup"),
    model: byId("ai-model"),
    start: byId("ai-start"),
    progress: byId("ai-progress"),
    progressBar: byId("ai-progress-bar"),
    progressText: byId("ai-progress-text"),
    stop: byId("ai-stop"),
  },
  (next) => {
    brain = next;
    sim.brain = next;
  },
);

// ---- Main loop ----

fillPicker();
let last = performance.now();
let lastPanel = 0;

function frame(now: number): void {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (!paused) {
    // Small fixed steps keep fast speeds smooth and stable.
    for (let left = dt * speed; left > 0; left -= 0.05)
      sim.update(Math.min(0.05, left));
  }
  renderer.draw(sim, now / 1000);
  if (now - lastPanel > 250) {
    lastPanel = now;
    panel.update(sim, sim.agentById(selectedId) ?? null);
  }
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
