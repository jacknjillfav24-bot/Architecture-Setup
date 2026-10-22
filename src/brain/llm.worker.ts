import { WebWorkerMLCEngineHandler } from "@mlc-ai/web-llm";

// Runs the AI model off the main thread so the world keeps animating.
const handler = new WebWorkerMLCEngineHandler();
self.onmessage = (message: MessageEvent) => handler.onmessage(message);
