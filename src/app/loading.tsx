"use client";

import React from "react";

export default function Loading() {
  const rows = Array.from({ length: 8 });

  return (
    <div
      className="min-h-screen bg-zinc-50 dark:bg-zinc-950 transition-colors"
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb Skeleton */}
        <div className="h-9 w-48 rounded-xl bg-zinc-200/60 dark:bg-zinc-800/60 animate-pulse mb-6" />

        {/* Heading Skeleton */}
        <div className="mb-6 space-y-2">
          <div className="h-8 w-64 rounded-xl bg-zinc-200/60 dark:bg-zinc-800/60 animate-pulse" />
          <div className="h-4 w-96 rounded-lg bg-zinc-200/40 dark:bg-zinc-800/40 animate-pulse" />
        </div>

        {/* Action bar skeleton */}
        <div className="mb-5 flex justify-between items-center">
          <div className="h-9 w-32 rounded-xl bg-zinc-200/50 dark:bg-zinc-800/50 animate-pulse" />
          <div className="h-9 w-28 rounded-xl bg-zinc-200/50 dark:bg-zinc-800/50 animate-pulse" />
        </div>

        {/* List items skeleton */}
        <ul className="space-y-2">
          {rows.map((_, i) => (
            <li
              key={i}
              className="flex items-center gap-3.5 px-4 py-3 rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 bg-white/60 dark:bg-zinc-900/40"
            >
              <div className="w-9 h-9 rounded-xl bg-zinc-200/70 dark:bg-zinc-800/70 animate-pulse shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div
                  className="h-4 rounded-md bg-zinc-200/70 dark:bg-zinc-800/70 animate-pulse"
                  style={{ width: `${45 + ((i * 17) % 35)}%` }}
                />
              </div>
              <div className="hidden sm:block h-7 w-20 rounded-lg bg-zinc-200/40 dark:bg-zinc-800/40 animate-pulse shrink-0" />
              <div className="hidden md:block h-4 w-16 rounded bg-zinc-200/40 dark:bg-zinc-800/40 animate-pulse shrink-0" />
              <div className="hidden md:block h-4 w-24 rounded bg-zinc-200/40 dark:bg-zinc-800/40 animate-pulse shrink-0" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
