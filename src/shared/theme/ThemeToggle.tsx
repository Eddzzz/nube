"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sun, Moon, Laptop } from "lucide-react";
import { useTheme } from "./ThemeProvider";

interface ThemeToggleProps {
  variant?: "icon" | "segmented";
  className?: string;
}

export function ThemeToggle({ variant = "icon", className = "" }: ThemeToggleProps) {
  const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className={`w-9 h-9 rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-100/50 dark:bg-zinc-900/50 ${className}`}
        aria-hidden="true"
      />
    );
  }

  if (variant === "segmented") {
    const options = [
      { id: "light" as const, label: "Claro", icon: Sun },
      { id: "system" as const, label: "Auto", icon: Laptop },
      { id: "dark" as const, label: "Oscuro", icon: Moon },
    ];

    return (
      <div
        role="radiogroup"
        aria-label="Seleccionar tema visual"
        className={`inline-flex items-center p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 ${className}`}
      >
        {options.map((opt) => {
          const Icon = opt.icon;
          const isActive = theme === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={isActive}
              onClick={() => setTheme(opt.id)}
              className="relative px-2.5 py-1 text-xs font-medium rounded-lg transition-colors duration-150 flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              {isActive && (
                <motion.div
                  layoutId="activeThemePill"
                  className="absolute inset-0 bg-white dark:bg-zinc-800 rounded-lg shadow-xs border border-zinc-200/60 dark:border-zinc-700/60"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                <Icon className="w-3.5 h-3.5" />
                <span>{opt.label}</span>
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <motion.button
      type="button"
      onClick={toggleTheme}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.92 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className={`relative p-2 rounded-xl liquid-glass-pill text-zinc-700 dark:text-zinc-200 transition-colors shadow-xs overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${className}`}
      aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      title={isDark ? "Modo oscuro activado (clic para cambiar)" : "Modo claro activado (clic para cambiar)"}
    >
      <AnimatePresence mode="wait" initial={false}>
        {isDark ? (
          <motion.div
            key="moon"
            initial={{ scale: 0.5, rotate: -90, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            exit={{ scale: 0.5, rotate: 90, opacity: 0 }}
            transition={{ type: "spring", stiffness: 350, damping: 22 }}
          >
            <Moon className="w-4 h-4 text-amber-300" />
          </motion.div>
        ) : (
          <motion.div
            key="sun"
            initial={{ scale: 0.5, rotate: 90, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            exit={{ scale: 0.5, rotate: -90, opacity: 0 }}
            transition={{ type: "spring", stiffness: 350, damping: 22 }}
          >
            <Sun className="w-4 h-4 text-amber-500" />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
