"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Trash2, X, Loader2 } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";

type ConfirmDeleteDialogProps = {
  open: boolean;
  itemName: string;
  loading: boolean;
  error?: string | null;
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
};

export default function ConfirmDeleteDialog({
  open,
  itemName,
  loading,
  error,
  onConfirm,
  onClose,
}: ConfirmDeleteDialogProps) {
  const { t } = useI18n();

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <motion.div
            aria-hidden
            onClick={() => {
              if (!loading) onClose();
            }}
            className="absolute inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            className="relative z-10 w-full max-w-md rounded-3xl liquid-glass p-6 sm:p-7 shadow-2xl"
            initial={{ scale: 0.94, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.94, opacity: 0, y: 16 }}
            transition={{ type: "spring", stiffness: 350, damping: 28 }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="rounded-xl bg-rose-500/10 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400 p-2.5">
                  <Trash2 className="h-5 w-5 stroke-[2.2]" />
                </span>
                <div>
                  <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                    {t("delete.dialog.title")}
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {t("delete.dialog.subtitle")}
                  </p>
                </div>
              </div>
              <motion.button
                type="button"
                whileTap={{ scale: 0.9 }}
                className="rounded-xl p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus:outline-none"
                onClick={() => {
                  if (!loading) onClose();
                }}
                aria-label={t("delete.cancel")}
                disabled={loading}
              >
                <X className="h-4 w-4" />
              </motion.button>
            </div>

            <div className="mt-5 space-y-3">
              <div className="rounded-xl bg-rose-500/8 dark:bg-rose-500/12 border border-rose-500/20 px-3.5 py-3 text-xs leading-relaxed text-rose-700 dark:text-rose-300 font-medium">
                {t("delete.confirm", { name: itemName })}
              </div>
              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xs font-medium text-rose-600 dark:text-rose-400"
                >
                  {error}
                </motion.p>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2.5">
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  if (!loading) onClose();
                }}
                disabled={loading}
                className="rounded-xl px-4 py-2 text-xs font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
              >
                {t("delete.cancel")}
              </motion.button>
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  if (!loading) onConfirm();
                }}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-rose-700 dark:bg-rose-500 dark:hover:bg-rose-600 transition-colors disabled:opacity-50"
              >
                {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{loading ? t("delete.deleting") : t("delete.action")}</span>
              </motion.button>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
