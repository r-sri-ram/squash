"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { ticketToMarkdown, githubIssueUrl, type Ticket } from "@/lib/ticket";
import { ScreenRecorder } from "@/components/ScreenRecorder";
import { ThemeToggle } from "@/components/ThemeToggle";

const EXAMPLE = `from #support slack:
"hey the app keeps logging me out?? on my iphone. i add stuff to cart, go to checkout and boom back at login screen. happened 3 times this morning. coworker on android says its fine for her. kinda urgent we have a customer demo at 2"`;

const SEVERITY: Record<string, { ring: string; dot: string; text: string }> = {
  critical: { ring: "ring-red-500/40", dot: "bg-red-500", text: "text-red-500" },
  high: { ring: "ring-orange-500/40", dot: "bg-orange-500", text: "text-orange-500" },
  medium: { ring: "ring-amber-500/40", dot: "bg-amber-500", text: "text-amber-600" },
  low: { ring: "ring-emerald-500/40", dot: "bg-emerald-500", text: "text-emerald-600" },
};

export default function Home() {
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<"paste" | "record">("paste");
  const [uploading, setUploading] = useState(false);
  const [currentId, setCurrentId] = useState<Id<"tickets"> | null>(null);
  const [copied, setCopied] = useState(false);
  const create = useMutation(api.tickets.create);
  const generateUploadUrl = useMutation(api.tickets.generateUploadUrl);
  const createFromRecording = useMutation(api.tickets.createFromRecording);
  const ticket = useQuery(
    api.tickets.get,
    currentId ? { id: currentId } : "skip",
  );

  const submit = async () => {
    if (!input.trim()) return;
    setCopied(false);
    const id = await create({ rawInput: input });
    setCurrentId(id);
  };

  const handleFrames = async (frames: Blob[]) => {
    setCopied(false);
    setUploading(true);
    setCurrentId(null);
    try {
      const ids: Id<"_storage">[] = [];
      for (const f of frames) {
        const url = await generateUploadUrl();
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "image/jpeg" },
          body: f,
        });
        const { storageId } = (await res.json()) as {
          storageId: Id<"_storage">;
        };
        ids.push(storageId);
      }
      const id = await createFromRecording({ frameIds: ids });
      setCurrentId(id);
    } finally {
      setUploading(false);
    }
  };

  const copyMarkdown = async () => {
    if (!ticket) return;
    await navigator.clipboard.writeText(ticketToMarkdown(ticket as Ticket));
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const ghUrl =
    ticket?.status === "ready" ? githubIssueUrl(ticket as Ticket) : null;
  const sev = SEVERITY[ticket?.severity ?? "medium"] ?? SEVERITY.medium;

  return (
    <div className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 pb-20">
      {/* Nav */}
      <motion.header
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="flex items-center justify-between py-7"
      >
        <div className="flex items-center gap-2.5">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-accent text-base font-black text-accent-ink">
            ▪
          </span>
          <span className="font-display text-lg font-extrabold tracking-tight">
            squash
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 rounded-full border border-line bg-surface-2 px-3 py-1.5 text-xs text-muted sm:flex">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
            messy report&nbsp;→&nbsp;filed-ready ticket
          </div>
          <ThemeToggle />
        </div>
      </motion.header>

      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.08, ease: "easeOut" }}
        className="mb-10 max-w-3xl"
      >
        <h1 className="font-display text-5xl font-extrabold leading-[1.02] tracking-tight sm:text-6xl">
          Squash the mess into a{" "}
          <span className="relative whitespace-nowrap text-accent-strong">
            clean ticket
            <svg
              className="absolute -bottom-2 left-0 w-full"
              viewBox="0 0 300 12"
              fill="none"
              preserveAspectRatio="none"
            >
              <motion.path
                d="M2 9 C 60 2, 120 2, 180 6 S 280 10, 298 4"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.8, delay: 0.7 }}
              />
            </svg>
          </span>
        </h1>
        <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-muted">
          Paste a Slack rant, a support note, a voice-note transcript — or record
          your screen. Squash returns a reproducible bug ticket with steps,
          expected vs actual, environment, severity, and the details your devs
          will ask for.
        </p>
      </motion.div>

      {/* Workspace */}
      <div className="grid flex-1 gap-5 lg:grid-cols-[1fr_1.1fr]">
        {/* Input */}
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.18 }}
          className="flex flex-col rounded-3xl border border-line bg-surface p-5"
        >
          <div className="mb-3 flex items-center justify-between">
            <div className="flex gap-1 rounded-full border border-line bg-surface-2 p-1">
              <TabBtn active={mode === "paste"} onClick={() => setMode("paste")}>
                paste
              </TabBtn>
              <TabBtn
                active={mode === "record"}
                onClick={() => setMode("record")}
              >
                record screen
              </TabBtn>
            </div>
            {mode === "paste" && (
              <button
                onClick={() => setInput(EXAMPLE)}
                className="font-mono text-[11px] text-muted transition hover:text-accent-strong"
              >
                load example ↘
              </button>
            )}
          </div>

          {mode === "paste" ? (
            <>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Paste the bug complaint here…"
                className="h-72 w-full flex-1 resize-none rounded-2xl border border-line bg-surface-2 p-4 font-mono text-[13px] leading-relaxed text-ink outline-none transition placeholder:text-faint focus:border-accent"
              />
              <button
                onClick={submit}
                disabled={!input.trim()}
                className="group mt-4 flex items-center justify-center gap-2 rounded-2xl bg-accent px-4 py-3.5 font-display text-sm font-bold text-accent-ink transition hover:brightness-105 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-30"
              >
                Squash it
                <span className="transition group-hover:translate-x-0.5">→</span>
              </button>
            </>
          ) : (
            <ScreenRecorder onFrames={handleFrames} disabled={uploading} />
          )}
        </motion.section>

        {/* Output */}
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.26 }}
          className="relative overflow-hidden rounded-3xl border border-line bg-surface p-5"
        >
          <div className="mb-4 flex items-center justify-between">
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint">
              the ticket
            </span>
            {ticket?.status === "ready" && (
              <span className="flex items-center gap-1.5 font-mono text-[11px] text-faint">
                confidence
                <span className={`${sev.text} font-semibold`}>
                  {ticket.confidence}
                </span>
              </span>
            )}
          </div>

          <AnimatePresence mode="wait">
            {!currentId && (
              <motion.div
                key="empty"
                exit={{ opacity: 0 }}
                className="flex h-80 flex-col items-center justify-center gap-3 text-center"
              >
                <div className="grid h-12 w-12 place-items-center rounded-2xl border border-dashed border-line text-faint">
                  ▪
                </div>
                <p className="max-w-[15rem] text-sm text-faint">
                  {uploading
                    ? "Uploading frames…"
                    : "Your filed-ready ticket will assemble here."}
                </p>
              </motion.div>
            )}

            {currentId && ticket?.status === "processing" && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="relative flex h-80 flex-col items-center justify-center gap-4"
              >
                <motion.div
                  className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent to-transparent"
                  animate={{ y: [0, 320, 0] }}
                  transition={{
                    duration: 1.6,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
                <div className="h-7 w-7 animate-spin rounded-full border-2 border-line border-t-accent" />
                <p className="font-mono text-xs text-faint">
                  {ticket?.source === "recording"
                    ? "watching the frames · writing repro steps…"
                    : "reading the mess · writing repro steps…"}
                </p>
              </motion.div>
            )}

            {ticket?.status === "error" && (
              <motion.div
                key="error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 font-mono text-xs leading-relaxed text-red-500"
              >
                {ticket.error}
              </motion.div>
            )}

            {ticket?.status === "ready" && (
              <motion.div
                key="ready"
                initial="hidden"
                animate="show"
                variants={{
                  hidden: {},
                  show: { transition: { staggerChildren: 0.08 } },
                }}
                className="space-y-5"
              >
                <Reveal>
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="font-display text-xl font-bold leading-snug text-ink">
                      {ticket.title}
                    </h2>
                    <span
                      className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wide ring-1 ${sev.ring} ${sev.text}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${sev.dot}`} />
                      {ticket.severity}
                    </span>
                  </div>
                  <p className="mt-1 font-mono text-[11px] text-faint">
                    {ticket.area}
                  </p>
                </Reveal>

                <Reveal>
                  <FieldLabel>steps to reproduce</FieldLabel>
                  <ol className="mt-2 space-y-1.5">
                    {ticket.stepsToReproduce?.map((s, i) => (
                      <li key={i} className="flex gap-3 text-[13px] text-ink">
                        <span className="mt-0.5 font-mono text-xs text-accent-strong">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ol>
                </Reveal>

                <Reveal>
                  <div className="grid grid-cols-2 gap-3">
                    <Box label="expected" value={ticket.expected} />
                    <Box label="actual" value={ticket.actual} />
                  </div>
                </Reveal>

                <Reveal>
                  <Box label="environment" value={ticket.environment} mono />
                </Reveal>

                {ticket.missing && ticket.missing.length > 0 && (
                  <Reveal>
                    <FieldLabel>still needed before a dev can start</FieldLabel>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {ticket.missing.map((m, i) => (
                        <span
                          key={i}
                          className="rounded-full border border-amber-500/30 bg-amber-400/10 px-2.5 py-1 font-mono text-[11px] text-amber-600"
                        >
                          ? {m}
                        </span>
                      ))}
                    </div>
                  </Reveal>
                )}

                <Reveal>
                  <div className="flex flex-wrap gap-2 border-t border-line pt-4">
                    <button
                      onClick={copyMarkdown}
                      className="rounded-xl border border-line bg-surface-2 px-3.5 py-2 font-mono text-xs text-ink transition hover:text-accent-strong"
                    >
                      {copied ? "✓ copied" : "copy markdown"}
                    </button>
                    {ghUrl && (
                      <a
                        href={ghUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-xl border border-line bg-surface-2 px-3.5 py-2 font-mono text-xs text-ink transition hover:text-accent-strong"
                      >
                        open github issue ↗
                      </a>
                    )}
                  </div>
                </Reveal>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>
      </div>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 font-mono text-[11px] lowercase tracking-wide transition ${
        active
          ? "bg-accent text-accent-ink"
          : "text-muted hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function Reveal({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 10 },
        show: { opacity: 1, y: 0 },
      }}
    >
      {children}
    </motion.div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
      {children}
    </span>
  );
}

function Box({
  label,
  value,
  mono,
}: {
  label: string;
  value?: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface-2 p-3">
      <FieldLabel>{label}</FieldLabel>
      <p
        className={`mt-1.5 text-[13px] text-ink ${mono ? "font-mono text-xs" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}
