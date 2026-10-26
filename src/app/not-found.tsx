"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Home, RefreshCw, Cloud, AlertCircle, ChevronRight } from "lucide-react";
import { useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";

export default function NotFound() {
  const { t } = useI18n();
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div className="relative min-h-screen overflow-hidden bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center px-4 transition-colors duration-200">
      {/* Background Grid Pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(#d4d4d8_1px,transparent_1px)] dark:bg-[radial-gradient(#27272a_1px,transparent_1px)] [background-size:24px_24px] opacity-60 pointer-events-none" />

      {/* Radial Glow */}
      <div className="absolute inset-0 bg-radial-[at_center] from-emerald-500/5 dark:from-emerald-500/10 via-transparent to-transparent pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 350, damping: 28 }}
        className="relative z-10 text-center max-w-xl mx-auto py-12"
      >
        {/* Animated 404 with Floating Cloud */}
        <div className="relative mb-6 select-none">
          <span className="text-[100px] sm:text-[140px] font-black tracking-tighter text-zinc-200/80 dark:text-zinc-800/80">
            404
          </span>
          <motion.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 cursor-pointer"
            animate={{
              y: [-4, 4, -4],
              scale: isHovered ? 1.15 : 1,
              rotate: isHovered ? 12 : 0,
            }}
            transition={{
              y: { duration: 4, repeat: Infinity, ease: "easeInOut" },
              scale: { duration: 0.25 },
              rotate: { duration: 0.25 },
            }}
            onHoverStart={() => setIsHovered(true)}
            onHoverEnd={() => setIsHovered(false)}
          >
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-emerald-500 text-white flex items-center justify-center shadow-xl shadow-emerald-500/25">
              <Cloud className="w-10 h-10 stroke-[2]" />
            </div>
          </motion.div>
        </div>

        {/* Message */}
        <div className="space-y-3 mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400 border border-rose-500/20">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>{t("notfound.badge")}</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            {t("notfound.title")}
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-md mx-auto leading-relaxed">
            {t("notfound.desc")}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs font-semibold shadow-md hover:bg-zinc-800 dark:hover:bg-white transition-colors"
            >
              <Home className="w-4 h-4" />
              <span>{t("notfound.home")}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </motion.div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-900/80 text-zinc-700 dark:text-zinc-300 text-xs font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors shadow-2xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{t("notfound.refresh")}</span>
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
