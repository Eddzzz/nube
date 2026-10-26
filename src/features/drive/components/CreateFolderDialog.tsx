"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FolderPlus, X, Loader2 } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";

type CreateFolderDialogProps = {
  open: boolean;
  submitting: boolean;
  error?: string | null;
  onConfirm: (name: string) => Promise<boolean>;
  onClose: () => void;
};

export default function CreateFolderDialog({
  open,
  submitting,
  error,
  onConfirm,
  onClose,
}: CreateFolderDialogProps) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setValidationError(null);
      const handle = window.setTimeout(() => inputRef.current?.focus(), 100);
      return () => window.clearTimeout(handle);
    }
    return undefined;
  }, [open]);

  const handleClose = () => {
    if (submitting) return;
    onClose();
  };

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setValidationError(t("folder.validation.required"));
      return;
    }

    setValidationError(null);
    const success = await onConfirm(trimmed);
    if (success) {
      setName("");
    }
  };

  const helperText = validationError ?? error ?? null;

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <motion.div
            aria-hidden
            onClick={handleClose}
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
                <span className="rounded-xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400 p-2.5">
                  <FolderPlus className="h-5 w-5 stroke-[2.2]" />
                </span>
                <div>
                  <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                    {t("folder.dialog.title")}
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {t("folder.dialog.subtitle")}
                  </p>
                </div>
              </div>
              <motion.button
                type="button"
                whileTap={{ scale: 0.9 }}
                className="rounded-xl p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus:outline-none"
                onClick={handleClose}
                aria-label={t("folder.cancel")}
                disabled={submitting}
              >
                <X className="h-4 w-4" />
              </motion.button>
            </div>

            <div className="mt-5 space-y-2">
              <label htmlFor="folder-name" className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                {t("folder.name.label")}
              </label>
              <input
                id="folder-name"
                ref={inputRef}
                value={name}
                onChange={(event) => setName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleSubmit();
                  }
                }}
                placeholder={t("folder.name.placeholder")}
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-3.5 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-100 dark:focus:border-emerald-500 dark:focus:bg-zinc-900"
                disabled={submitting}
              />
              {helperText && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xs font-medium text-rose-600 dark:text-rose-400"
                >
                  {helperText}
                </motion.p>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2.5">
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleClose}
                disabled={submitting}
                className="rounded-xl px-4 py-2 text-xs font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
              >
                {t("folder.cancel")}
              </motion.button>
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleSubmit}
                disabled={submitting}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white transition-colors disabled:opacity-50"
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{submitting ? t("folder.creating") : t("folder.submit")}</span>
              </motion.button>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
