"use client";

import { useEffect, useRef, useState } from "react";

const MAX_FRAMES = 8;
const FRAME_INTERVAL_MS = 1000;
const MAX_WIDTH = 1280;

export function ScreenRecorder({
  onFrames,
  disabled,
}: {
  onFrames: (frames: Blob[]) => void;
  disabled?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const framesRef = useRef<Blob[]>([]);
  const intervalRef = useRef<number | null>(null);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [count, setCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const cleanup = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  useEffect(() => cleanup, []);

  const captureFrame = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const scale = Math.min(1, MAX_WIDTH / video.videoWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (b) => {
        if (b) {
          framesRef.current.push(b);
          setCount(framesRef.current.length);
        }
      },
      "image/jpeg",
      0.6,
    );
  };

  const start = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 15 },
        audio: false,
      });
      streamRef.current = stream;
      framesRef.current = [];
      setCount(0);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      stream.getVideoTracks()[0].addEventListener("ended", stop);
      setRecording(true);
      setElapsed(0);
      const startedAt = Date.now();
      window.setTimeout(captureFrame, 300);
      intervalRef.current = window.setInterval(() => {
        setElapsed(Math.floor((Date.now() - startedAt) / 1000));
        captureFrame();
      }, FRAME_INTERVAL_MS);
    } catch {
      setError("Screen capture was blocked or cancelled.");
    }
  };

  const stop = () => {
    cleanup();
    setRecording(false);
    const all = framesRef.current;
    if (all.length === 0) {
      setError("No frames captured — try recording a few seconds.");
      return;
    }
    let frames = all;
    if (all.length > MAX_FRAMES) {
      frames = Array.from(
        { length: MAX_FRAMES },
        (_, i) => all[Math.floor((i * (all.length - 1)) / (MAX_FRAMES - 1))],
      );
    }
    onFrames(frames);
  };

  const mmss = `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(
    elapsed % 60,
  ).padStart(2, "0")}`;

  return (
    <div className="flex h-72 flex-1 flex-col">
      <div className="relative flex-1 overflow-hidden rounded-2xl border border-line bg-surface-2">
        <video
          ref={videoRef}
          muted
          playsInline
          className={`h-full w-full object-contain ${recording ? "" : "hidden"}`}
        />
        {recording && (
          <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/70 px-2.5 py-1 font-mono text-[11px] text-zinc-100 backdrop-blur">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
            REC {mmss} · {count} frames
          </div>
        )}
        {!recording && (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-2xl border border-line text-faint">
              ⦿
            </div>
            <p className="max-w-[18rem] text-sm text-faint">
              Record your screen reproducing the bug. Squash reads the frames and
              writes the steps.
            </p>
            {error && (
              <p className="font-mono text-[11px] text-red-500">{error}</p>
            )}
          </div>
        )}
      </div>

      {!recording ? (
        <button
          onClick={start}
          disabled={disabled}
          className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-accent px-4 py-3.5 font-display text-sm font-bold text-accent-ink transition hover:brightness-105 active:scale-[0.99] disabled:opacity-30"
        >
          ⦿ Record screen
        </button>
      ) : (
        <button
          onClick={stop}
          className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-red-500/90 px-4 py-3.5 font-display text-sm font-bold text-white transition hover:bg-red-500 active:scale-[0.99]"
        >
          ◼ Stop &amp; squash
        </button>
      )}
    </div>
  );
}
