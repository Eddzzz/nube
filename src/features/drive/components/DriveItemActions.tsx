"use client";

import { useEffect, useRef } from "react";
import { MoreVertical, Pencil, Trash2, QrCode } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useI18n } from "@/i18n/I18nProvider";

type DriveItemActionsProps = {
  isOpen: boolean;
  disabled?: boolean;
  canRename?: boolean;
  canDelete?: boolean;
  canShare?: boolean;
  onOpen: () => void;
  onClose: () => void;
  onRename: () => void;
  onDelete: () => void;
  onShare?: () => void;
};

export default function DriveItemActions({
  isOpen,
  disabled = false,
  canRename = false,
  canDelete = false,
  canShare = false,
  onOpen,
  onClose,
  onRename,
  onDelete,
  onShare,
}: DriveItemActionsProps) {
  const { t } = useI18n();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointer(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        onClose();
      }
    }

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [isOpen, onClose]);

  return (
    <div className="relative z-30" ref={menuRef}>
      <motion.button
        type="button"
        whileTap={{ scale: 0.9 }}
        whileHover={{ scale: 1.05 }}
        onClick={() => (isOpen ? onClose() : onOpen())}
        disabled={disabled}
        className="inline-flex items-center justify-center rounded-lg border border-transparent hover:border-zinc-200/80 dark:hover:border-zinc-700/80 bg-transparent hover:bg-zinc-200/60 dark:hover:bg-zinc-800 p-1.5 text-zinc-400 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={t("actions.more")}
      >
        <MoreVertical size={15} />
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ type: "spring", stiffness: 450, damping: 28 }}
            className="absolute right-0 z-50 mt-1.5 w-44 overflow-hidden rounded-2xl liquid-glass shadow-2xl p-1.5"
          >
            {canShare && onShare && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onShare();
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-zinc-700 hover:bg-zinc-100/80 dark:text-zinc-200 dark:hover:bg-zinc-800/80 transition-colors"
              >
                <QrCode size={14} className="text-emerald-500" />
                <span>{t("share.action")}</span>
              </button>
            )}
            {canRename && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onRename();
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-zinc-700 hover:bg-zinc-100/80 dark:text-zinc-200 dark:hover:bg-zinc-800/80 transition-colors"
              >
                <Pencil size={14} className="text-zinc-500" />
                <span>{t("rename.action")}</span>
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onDelete();
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-rose-600 hover:bg-rose-500/10 dark:text-rose-400 dark:hover:bg-rose-500/15 transition-colors"
              >
                <Trash2 size={14} />
                <span>{t("delete.action")}</span>
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
