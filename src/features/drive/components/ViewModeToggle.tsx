"use client";

import { List, LayoutGrid } from "lucide-react";
import { motion } from "framer-motion";
import { useI18n } from "@/i18n/I18nProvider";

export type ViewMode = "list" | "grid";

interface ViewModeToggleProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

export default function ViewModeToggle({ viewMode, onViewModeChange }: ViewModeToggleProps) {
  const { t } = useI18n();

  return (
    <div className="inline-flex items-center p-1 rounded-2xl liquid-glass-pill shadow-2xs">
      <button
        type="button"
        onClick={() => onViewModeChange("list")}
        className={`relative inline-flex items-center justify-center rounded-xl p-1.5 text-xs font-medium transition-colors z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
          viewMode === "list"
            ? "text-zinc-900 dark:text-zinc-100"
            : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
        }`}
        aria-label={t("view.list")}
        title={t("view.list")}
      >
        {viewMode === "list" && (
          <motion.div
            layoutId="viewModeHighlight"
            className="absolute inset-0 bg-white/90 dark:bg-zinc-800/90 rounded-xl shadow-xs border border-white/60 dark:border-zinc-700/60 -z-10 backdrop-blur-sm"
            transition={{ type: "spring", stiffness: 450, damping: 32 }}
          />
        )}
        <List size={16} />
      </button>

      <button
        type="button"
        onClick={() => onViewModeChange("grid")}
        className={`relative inline-flex items-center justify-center rounded-xl p-1.5 text-xs font-medium transition-colors z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
          viewMode === "grid"
            ? "text-zinc-900 dark:text-zinc-100"
            : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
        }`}
        aria-label={t("view.grid")}
        title={t("view.grid")}
      >
        {viewMode === "grid" && (
          <motion.div
            layoutId="viewModeHighlight"
            className="absolute inset-0 bg-white/90 dark:bg-zinc-800/90 rounded-xl shadow-xs border border-white/60 dark:border-zinc-700/60 -z-10 backdrop-blur-sm"
            transition={{ type: "spring", stiffness: 450, damping: 32 }}
          />
        )}
        <LayoutGrid size={16} />
      </button>
    </div>
  );
}
