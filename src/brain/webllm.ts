import type { ChatEngine } from "./aiBrain";

export interface ModelOption {
  key: "small" | "smart";
  label: string;
  /** WebLLM model id without the quantization suffix. */
  base: string;
  size: string;
}

export const MODEL_OPTIONS: ModelOption[] = [
  {
    key: "small",
    label: "Small and quick",
    base: "Qwen2.5-0.5B-Instruct",
    size: "about 300 MB",
  },
  {
    key: "smart",
    label: "Smarter, slower",
    base: "Llama-3.2-1B-Instruct",
    size: "about 700 MB",
  },
];

export interface GpuCheck {
  ok: boolean;
  /** Whether the GPU supports 16-bit shaders, which allows smaller model files. */
  f16: boolean;
  reason: string;
}

interface GpuAdapterLike {
  features: { has(feature: string): boolean };
}

interface NavigatorWithGpu {
  gpu?: { requestAdapter(): Promise<GpuAdapterLike | null> };
}

const NEEDS =
  "The AI needs WebGPU: try a recent Chrome or Edge on a laptop or desktop.";

export async function checkWebGPU(): Promise<GpuCheck> {
  const gpu = (navigator as NavigatorWithGpu).gpu;
  if (!gpu)
    return {
      ok: false,
      f16: false,
      reason: `This browser can't run it. ${NEEDS}`,
    };
  try {
    const adapter = await gpu.requestAdapter();
    if (!adapter)
      return {
        ok: false,
        f16: false,
        reason: `No usable graphics chip was found. ${NEEDS}`,
      };
    return { ok: true, f16: adapter.features.has("shader-f16"), reason: "" };
  } catch {
    return {
      ok: false,
      f16: false,
      reason: `The graphics chip could not be used. ${NEEDS}`,
    };
  }
}

export function modelId(option: ModelOption, f16: boolean): string {
  return `${option.base}-${f16 ? "q4f16_1" : "q4f32_1"}-MLC`;
}

/**
 * Downloads (once; the browser caches it) and starts an AI model that runs
 * entirely on this device, inside a background worker so the world stays smooth.
 */
export async function loadWebLLM(
  option: ModelOption,
  f16: boolean,
  onProgress: (fraction: number, text: string) => void,
): Promise<ChatEngine> {
  const webllm = await import("@mlc-ai/web-llm");
  const worker = new Worker(new URL("./llm.worker.ts", import.meta.url), {
    type: "module",
  });
  try {
    const engine = await webllm.CreateWebWorkerMLCEngine(
      worker,
      modelId(option, f16),
      {
        initProgressCallback: (report) =>
          onProgress(report.progress, report.text),
      },
    );
    return {
      async complete(system, prompt, maxTokens) {
        const reply = await engine.chat.completions.create({
          messages: [
            { role: "system", content: system },
            { role: "user", content: prompt },
          ],
          max_tokens: maxTokens,
          temperature: 0.8,
        });
        return reply.choices[0]?.message.content ?? "";
      },
    };
  } catch (error) {
    worker.terminate();
    throw error;
  }
}
