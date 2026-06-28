"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

const VISION_PROMPT = `You are given sequential screenshots captured from a screen recording of a software bug, in chronological order. Infer what the user did and what went wrong by reading the UI across frames.

Return ONLY a JSON object with these exact keys:
- "title": short imperative summary of the bug (max 12 words).
- "stepsToReproduce": array of short imperative steps, derived from the visible UI actions across the frames.
- "expected": one sentence — what should have happened.
- "actual": one sentence — what actually happened (the observed failure).
- "environment": infer OS / browser / app from visible window chrome, title bars, or UI; else "Not specified".
- "severity": one of "critical", "high", "medium", "low".
- "area": the feature or surface affected (e.g. "Checkout", "Login"); else "Unknown".
- "missing": array (max 4) of important details a developer would still need that the frames don't reveal (e.g. "App build/version", "Console/network errors", "Account used"). Empty array if complete.
- "confidence": one of "high", "medium", "low" — how confident the repro is correct from the frames.

Base every step on something visible. Do not invent UI that is not shown. Output valid JSON only, no markdown.`;

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

function normalize(parsed: Record<string, unknown>): TicketFields {
  return {
    title: (parsed.title as string) ?? "Untitled bug",
    stepsToReproduce: Array.isArray(parsed.stepsToReproduce)
      ? (parsed.stepsToReproduce as string[])
      : ["Could not derive steps from the recording"],
    expected: (parsed.expected as string) ?? "Not specified",
    actual: (parsed.actual as string) ?? "Not specified",
    environment: (parsed.environment as string) ?? "Not specified",
    severity: (parsed.severity as string) ?? "medium",
    area: (parsed.area as string) ?? "Unknown",
    missing: Array.isArray(parsed.missing) ? (parsed.missing as string[]) : [],
    confidence: (parsed.confidence as string) ?? "medium",
  };
}

async function callVisionLLM(images: string[]): Promise<TicketFields> {
  const baseUrl = process.env.LLM_BASE_URL ?? "https://api.openai.com/v1";
  const apiKey = process.env.LLM_API_KEY;
  const model = process.env.LLM_VISION_MODEL ?? "gpt-4o";
  if (!apiKey) {
    throw new Error("LLM_API_KEY not set. Run: npx convex env set LLM_API_KEY <key>");
  }

  const content = [
    { type: "text", text: "Frames in chronological order:" },
    ...images.map((url) => ({ type: "image_url", image_url: { url } })),
  ];

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
        { role: "system", content: VISION_PROMPT },
        { role: "user", content },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`Vision LLM ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  const text: string = data.choices?.[0]?.message?.content ?? "{}";
  return normalize(JSON.parse(text));
}

export const generateFromFrames = internalAction({
  args: { id: v.id("tickets"), frameIds: v.array(v.id("_storage")) },
  handler: async (ctx, { id, frameIds }) => {
    try {
      const images: string[] = [];
      for (const fid of frameIds) {
        const blob = await ctx.storage.get(fid);
        if (!blob) continue;
        const buf = await blob.arrayBuffer();
        const b64 = Buffer.from(buf).toString("base64");
        images.push(`data:image/jpeg;base64,${b64}`);
      }
      if (images.length === 0) {
        throw new Error("No frames could be read from storage.");
      }
      const result = await callVisionLLM(images);
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
    } finally {
      for (const fid of frameIds) {
        await ctx.storage.delete(fid).catch(() => {});
      }
    }
  },
});
