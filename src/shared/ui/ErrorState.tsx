"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { AlertCircle } from "lucide-react";

type Props = {
  title: string;
  description?: string;
  details?: string;
  actions?: Array<{ href: string; label: string; variant?: "primary" | "secondary" }>;
  className?: string;
};

export default function ErrorState({ title, description, details, actions, className }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 350, damping: 28 }}
      className={`mx-auto mt-12 max-w-2xl rounded-3xl border border-rose-500/20 bg-rose-500/5 dark:bg-rose-500/10 p-6 sm:p-8 backdrop-blur-md shadow-lg ${
        className ?? ""
      }`}
    >
      <div className="flex items-start gap-4">
        <div className="mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-600 dark:text-rose-400 shrink-0">
          <AlertCircle className="h-5 w-5 stroke-[2.2]" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            {title}
          </h2>
          {description && (
            <p className="mt-1.5 text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
              {description}
            </p>
          )}
          {details && (
            <pre className="mt-3.5 overflow-x-auto whitespace-pre-wrap rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-950/80 p-3.5 text-xs font-mono text-zinc-700 dark:text-zinc-300">
              {details}
            </pre>
          )}
          {actions && actions.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2.5">
              {actions.map((a) => (
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} key={a.href + a.label}>
                  <Link
                    href={a.href}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition-colors shadow-2xs ${
                      a.variant === "secondary"
                        ? "border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        : "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                    }`}
                  >
                    {a.label}
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
