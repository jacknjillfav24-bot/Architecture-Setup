import { cleanReply, type Brain, type ThoughtRequest } from "./brain";

/** Anything that can answer a chat prompt, e.g. the in-browser WebLLM engine. */
export interface ChatEngine {
  complete(system: string, prompt: string, maxTokens: number): Promise<string>;
}

interface Job {
  request: ThoughtRequest;
  resolve: (text: string) => void;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("AI took too long")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

/**
 * A brain backed by a real AI model. Requests are answered one at a time;
 * small talk is skipped when the AI has a backlog, and any failure falls back
 * to the rule-based answer so the world never stalls.
 */
export class AIBrain implements Brain {
  readonly label: string;
  answered = 0;
  failures = 0;
  private readonly engine: ChatEngine;
  private readonly timeoutMs: number;
  private readonly queue: Job[] = [];
  private running = false;

  constructor(engine: ChatEngine, label: string, timeoutMs = 30_000) {
    this.engine = engine;
    this.label = label;
    this.timeoutMs = timeoutMs;
  }

  /** How many thoughts are waiting for the AI, including the current one. */
  get pending(): number {
    return this.queue.length + (this.running ? 1 : 0);
  }

  think(request: ThoughtRequest): string | Promise<string> {
    if (request.optional && this.pending >= 2) return request.fallback;
    return new Promise((resolve) => {
      this.queue.push({ request, resolve });
      void this.drain();
    });
  }

  private async drain(): Promise<void> {
    if (this.running) return;
    this.running = true;
    for (let job = this.queue.shift(); job; job = this.queue.shift()) {
      job.resolve(await this.ask(job.request));
    }
    this.running = false;
  }

  private async ask(request: ThoughtRequest): Promise<string> {
    try {
      const raw = await withTimeout(
        this.engine.complete(
          request.persona,
          request.prompt,
          request.maxTokens,
        ),
        this.timeoutMs,
      );
      const text = cleanReply(raw, request.maxChars);
      if (!text) return request.fallback;
      this.answered++;
      return text;
    } catch {
      this.failures++;
      return request.fallback;
    }
  }
}
