import { AIBrain } from "../brain/aiBrain";
import { RuleBrain, type Brain } from "../brain/brain";
import {
  MODEL_OPTIONS,
  checkWebGPU,
  loadWebLLM,
  type GpuCheck,
  type ModelOption,
} from "../brain/webllm";

export interface AIElements {
  status: HTMLElement;
  setup: HTMLElement;
  model: HTMLSelectElement;
  start: HTMLButtonElement;
  progress: HTMLElement;
  progressBar: HTMLProgressElement;
  progressText: HTMLElement;
  stop: HTMLButtonElement;
}

/** Rewrites WebLLM's technical progress messages in plain words. */
function friendlyProgress(text: string): string {
  const fetched = /(\d+)\s*MB fetched/i.exec(text);
  if (/fetching/i.test(text))
    return fetched ? `Downloading: ${fetched[1]} MB so far` : "Downloading";
  if (/loading model from cache/i.test(text))
    return "Loading from your browser's storage";
  if (/finish/i.test(text)) return "Almost ready";
  return "Preparing";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Wires up the "AI brain" card. `setBrain` swaps the brain the agents use. */
export function setupAIControls(
  ui: AIElements,
  setBrain: (brain: Brain) => void,
): void {
  for (const option of MODEL_OPTIONS) {
    const item = document.createElement("option");
    item.value = option.key;
    item.textContent = `${option.label} (${option.size})`;
    ui.model.append(item);
  }

  let gpu: GpuCheck | null = null;
  let active: AIBrain | null = null;
  const loaded = new Map<ModelOption["key"], AIBrain>();

  const showRules = (message: string) => {
    active = null;
    ui.status.textContent = message;
    ui.setup.hidden = false;
    ui.progress.hidden = true;
    ui.stop.hidden = true;
    ui.start.disabled = !gpu?.ok;
    ui.model.disabled = !gpu?.ok;
  };

  const showLive = () => {
    if (!active) return;
    const waiting = active.pending;
    const now =
      waiting > 0
        ? `Thinking about ${waiting} thing${waiting === 1 ? "" : "s"}…`
        : "Waiting for the next decision.";
    ui.status.textContent = `The AI brain is on (${active.label}). ${now} Answers so far: ${active.answered}.`;
  };

  void checkWebGPU().then((result) => {
    gpu = result;
    showRules(
      result.ok
        ? "Agents are following built-in rules. Turn on the AI brain to let them think for themselves."
        : `Agents are following built-in rules. ${result.reason}`,
    );
  });

  ui.start.addEventListener("click", () => {
    void turnOn();
  });

  ui.stop.addEventListener("click", () => {
    setBrain(new RuleBrain());
    showRules(
      "Back to built-in rules. Turning the AI on again is instant: it won't download again.",
    );
    ui.start.textContent = "Turn AI brain back on";
  });

  async function turnOn(): Promise<void> {
    if (!gpu?.ok) return;
    const option =
      MODEL_OPTIONS.find((o) => o.key === ui.model.value) ?? MODEL_OPTIONS[0];
    if (!option) return;
    let brain = loaded.get(option.key);
    if (!brain) {
      ui.start.disabled = true;
      ui.model.disabled = true;
      ui.progress.hidden = false;
      ui.progressBar.value = 0;
      ui.progressText.textContent = "Starting";
      ui.status.textContent = `Getting the AI ready. The first time, this downloads ${option.size}.`;
      try {
        const engine = await loadWebLLM(option, gpu.f16, (fraction, text) => {
          ui.progressBar.value = fraction;
          ui.progressText.textContent = `${Math.round(fraction * 100)}% · ${friendlyProgress(text)}`;
        });
        brain = new AIBrain(engine, option.label);
        loaded.set(option.key, brain);
      } catch (error) {
        showRules(
          `The AI couldn't start, so agents keep using the rules. (${errorMessage(error)})`,
        );
        return;
      }
    }
    active = brain;
    setBrain(brain);
    ui.setup.hidden = true;
    ui.progress.hidden = true;
    ui.stop.hidden = false;
    showLive();
  }

  setInterval(showLive, 500);
}
