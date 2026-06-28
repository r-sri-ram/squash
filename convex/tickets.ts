import { v } from "convex/values";
import {
  mutation,
  query,
  internalAction,
  internalMutation,
} from "./_generated/server";
import { api, internal } from "./_generated/api";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("tickets").order("desc").take(20);
  },
});

export const get = query({
  args: { id: v.id("tickets") },
  handler: async (ctx, { id }) => await ctx.db.get(id),
});

export const create = mutation({
  args: { rawInput: v.string() },
  handler: async (ctx, { rawInput }) => {
    const id = await ctx.db.insert("tickets", {
      rawInput,
      source: "text",
      status: "processing",
    });
    await ctx.scheduler.runAfter(0, internal.tickets.generate, { id });
    return id;
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => await ctx.storage.generateUploadUrl(),
});

export const createFromRecording = mutation({
  args: { frameIds: v.array(v.id("_storage")) },
  handler: async (ctx, { frameIds }) => {
    const id = await ctx.db.insert("tickets", {
      rawInput: `[screen recording · ${frameIds.length} frames]`,
      source: "recording",
      status: "processing",
    });
    await ctx.scheduler.runAfter(0, internal.vision.generateFromFrames, {
      id,
      frameIds,
    });
    return id;
  },
});

export const setResult = internalMutation({
  args: {
    id: v.id("tickets"),
    status: v.union(v.literal("ready"), v.literal("error")),
    title: v.optional(v.string()),
    stepsToReproduce: v.optional(v.array(v.string())),
    expected: v.optional(v.string()),
    actual: v.optional(v.string()),
    environment: v.optional(v.string()),
    severity: v.optional(v.string()),
    area: v.optional(v.string()),
    missing: v.optional(v.array(v.string())),
    confidence: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...fields }) => {
    await ctx.db.patch(id, fields);
  },
});

const SYSTEM_PROMPT = `You convert a messy, free-form bug complaint (Slack message, support note, voice-note transcript, screenshot description) into ONE clean, reproducible engineering bug ticket.

Return ONLY a JSON object with these exact keys:
- "title": a short, specific imperative summary (max 12 words). Not "App broken".
- "stepsToReproduce": an array of short imperative steps. Infer the obvious implicit steps a reader would need. If truly unknown, use ["Not specified in report"].
- "expected": one sentence describing what should happen.
- "actual": one sentence describing what actually happens.
- "environment": device / OS / browser / app version if mentioned, else "Not specified".
- "severity": one of "critical", "high", "medium", "low" — judge from impact described.
- "area": the feature or surface affected (e.g. "Checkout", "Login", "Notifications"), else "Unknown".
- "missing": array of the most important details a developer would still need that the report did NOT provide (e.g. "App build/version", "Exact account or order ID", "Network conditions"). Max 4. Empty array if the report is complete.
- "confidence": one of "high", "medium", "low" — how confident you are this ticket is reproducible as written.

Rules:
- Be concrete. Turn vague language into precise, testable statements.
- Never invent environment details that weren't implied; mark "Not specified".
- Output valid JSON only. No markdown, no commentary.`;

type TicketFields = {
  title: string;
  stepsToReproduce: string[];
  expected: string;
  actual: string;
  environment: string;
  severity: string;
  area: string;
  missing: string[];
  confidence: string;
};

async function callLLM(rawInput: string): Promise<TicketFields> {
  const baseUrl = process.env.LLM_BASE_URL ?? "https://api.openai.com/v1";
  const apiKey = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL ?? "gpt-4o-mini";
  if (!apiKey) {
    throw new Error(
      "LLM_API_KEY not set. Run: npx convex env set LLM_API_KEY <key>",
    );
  }

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: rawInput },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`LLM ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  const content: string = data.choices?.[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(content);

  return {
    title: parsed.title ?? "Untitled bug",
    stepsToReproduce: Array.isArray(parsed.stepsToReproduce)
      ? parsed.stepsToReproduce
      : ["Not specified in report"],
    expected: parsed.expected ?? "Not specified",
    actual: parsed.actual ?? "Not specified",
    environment: parsed.environment ?? "Not specified",
    severity: parsed.severity ?? "medium",
    area: parsed.area ?? "Unknown",
    missing: Array.isArray(parsed.missing) ? parsed.missing : [],
    confidence: parsed.confidence ?? "medium",
  };
}

export const generate = internalAction({
  args: { id: v.id("tickets") },
  handler: async (ctx, { id }) => {
    const ticket = await ctx.runQuery(api.tickets.get, { id });
    if (!ticket) return;
    try {
      const result = await callLLM(ticket.rawInput);
      await ctx.runMutation(internal.tickets.setResult, {
        id,
        status: "ready",
        ...result,
      });
    } catch (e) {
      await ctx.runMutation(internal.tickets.setResult, {
        id,
        status: "error",
        error: e instanceof Error ? e.message : String(e),
      });
    }
  },
});
