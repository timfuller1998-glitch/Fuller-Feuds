/**
 * One place for the OpenAI chat model and request parameters (Fuller Feuds Dev, Nov 22 2026).
 *
 * Default: gpt-6-luna, OpenAI's current low-cost model for high-volume tasks
 * ($0.10 / $0.50 per 1M input/output tokens, cheaper than gpt-4o-mini). Override with
 * the OPENAI_MODEL env var without a code change.
 *
 * Newer reasoning models (gpt-5*, gpt-6*, o-series) reject `max_tokens` and custom
 * `temperature`, and count hidden reasoning tokens against `max_completion_tokens`.
 * chatParams() builds the right fields for whichever model is configured.
 */
import OpenAI from "openai";

export const AI_MODEL: string = process.env.OPENAI_MODEL?.trim() || "gpt-6-luna";
export const EMBEDDING_MODEL: string = process.env.OPENAI_EMBEDDING_MODEL?.trim() || "text-embedding-3-small";

export function isReasoningModel(model: string = AI_MODEL): boolean {
  return /^(gpt-5|gpt-6|o\d)/i.test(model);
}

/** Extra output budget for reasoning tokens on reasoning models (low effort keeps this small). */
const REASONING_HEADROOM = 1500;

export function chatParams(opts: { maxTokens: number; temperature?: number; json?: boolean; model?: string }) {
  const model = opts.model ?? AI_MODEL;
  const reasoning = isReasoningModel(model);
  return {
    model,
    max_completion_tokens: reasoning ? opts.maxTokens + REASONING_HEADROOM : opts.maxTokens,
    ...(opts.json ? { response_format: { type: "json_object" as const } } : {}),
    ...(reasoning
      ? { reasoning_effort: "low" as const }
      : opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
  };
}

/** Short, key-free description of an OpenAI error for logs and admin messages. */
export function describeAIError(error: unknown): string {
  const e = error as any;
  if (e && typeof e === "object" && ("status" in e || "code" in e)) {
    const parts = [e.status, e.code || e.error?.code, e.type || e.error?.type].filter(Boolean);
    const msg = String(e.error?.message || e.message || "").replace(/sk-[A-Za-z0-9_\-]{8,}/g, "sk-…");
    return `${parts.join(" ")}${msg ? `: ${msg.slice(0, 200)}` : ""}`;
  }
  return error instanceof Error ? error.message : String(error);
}

export type AIHealth = { ok: boolean; model: string; checkedAt: string; error?: string };
let lastHealth: AIHealth | null = null;
let lastFailure: { at: string; error: string } | null = null;

export function recordAIFailure(error: unknown): string {
  const msg = describeAIError(error);
  lastFailure = { at: new Date().toISOString(), error: msg };
  return msg;
}
export function getAIStatus() {
  return { model: AI_MODEL, configured: !!process.env.OPENAI_API_KEY, lastHealth, lastFailure };
}

/** Tiny live request to confirm the key, credits and model work. Never logs the key. */
export async function checkAIHealth(): Promise<AIHealth> {
  const checkedAt = new Date().toISOString();
  if (!process.env.OPENAI_API_KEY) {
    lastHealth = { ok: false, model: AI_MODEL, checkedAt, error: "OPENAI_API_KEY is not set" };
    return lastHealth;
  }
  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 20_000, maxRetries: 0 });
    const res = await client.chat.completions.create({
      ...chatParams({ maxTokens: 16 }),
      messages: [{ role: "user", content: "Reply with the single word OK." }],
    });
    const text = res.choices[0]?.message?.content ?? "";
    lastHealth = { ok: true, model: res.model || AI_MODEL, checkedAt };
    console.log(`[AI] OpenAI check OK (model ${lastHealth.model}, reply ${JSON.stringify(text.slice(0, 10))})`);
  } catch (error) {
    lastHealth = { ok: false, model: AI_MODEL, checkedAt, error: describeAIError(error) };
    console.error(`[AI] OpenAI check FAILED (model ${AI_MODEL}): ${lastHealth.error}`);
  }
  return lastHealth;
}
