import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  tickets: defineTable({
    rawInput: v.string(),
    source: v.optional(v.union(v.literal("text"), v.literal("recording"))),
    status: v.union(
      v.literal("processing"),
      v.literal("ready"),
      v.literal("error"),
    ),
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
  }),
});
