"use client";

import React, { useEffect, useRef, useState } from "react";
import { Play, Pause, Volume2, VolumeX } from "lucide-react";
import { motion } from "framer-motion";

export default function AudioPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    setReady(false);
    setPlaying(false);
    setProgress(0);
    setDuration(0);
  }, [src]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onLoaded = () => {
      setDuration(audio.duration || 0);
      setReady(true);
    };
    const onTime = () => setProgress(audio.currentTime || 0);
    const onEnded = () => setPlaying(false);

    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("ended", onEnded);
    };
  }, [src]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.muted = muted;
  }, [muted]);

  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      try {
        await audio.play();
        setPlaying(true);
      } catch {
        setPlaying(false);
      }
    }
  };

  const onSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const value = Number(e.target.value);
    audio.currentTime = value;
    setProgress(value);
  };

  const fmt = (t: number) => {
    if (!isFinite(t)) t = 0;
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const pct = duration ? Math.min(100, Math.max(0, (progress / duration) * 100)) : 0;

  return (
    <div className="w-full max-w-xl mx-auto rounded-3xl liquid-glass p-5 shadow-2xl">
      <audio ref={audioRef} src={src} preload="metadata" />

      <div className="flex items-center gap-3 sm:gap-4">
        <motion.button
          type="button"
          onClick={toggle}
          disabled={!ready}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="grid place-items-center w-11 h-11 rounded-2xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-md hover:bg-zinc-800 dark:hover:bg-white transition-colors disabled:opacity-50 shrink-0"
          aria-label={playing ? "Pausar" : "Reproducir"}
        >
          {playing ? <Pause size={18} /> : <Play size={18} className="translate-x-[1px]" />}
        </motion.button>

        <div className="flex-1 min-w-0">
          <div className="relative h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-emerald-600 dark:bg-emerald-500 rounded-full transition-all duration-100"
              style={{ width: `${pct}%` }}
            />
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.1}
              value={progress}
              onChange={onSeek}
              className="absolute inset-0 w-full opacity-0 cursor-pointer"
              aria-label="Progreso de reproducción"
            />
          </div>
          <div className="mt-2 flex justify-between text-[11px] text-zinc-400 dark:text-zinc-500 font-mono tabular-nums">
            <span>{fmt(progress)}</span>
            <span>{fmt(duration)}</span>
          </div>
        </div>

        <motion.button
          type="button"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setMuted((m) => !m)}
          className="grid place-items-center w-9 h-9 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-colors shrink-0"
          aria-label={muted ? "Activar sonido" : "Silenciar"}
        >
          {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
        </motion.button>
      </div>
    </div>
  );
}
