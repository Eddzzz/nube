"use client";

import { useState } from "react";
import { QrCode } from "lucide-react";
import ShareDialog from "./ShareDialog";

interface ShareButtonProps {
  itemId: string;
  itemName: string;
  variant?: "primary" | "secondary" | "icon";
  className?: string;
}

export default function ShareButton({
  itemId,
  itemName,
  variant = "secondary",
  className = "",
}: ShareButtonProps) {
  const [open, setOpen] = useState(false);

  const baseStyle =
    variant === "icon"
      ? "p-2 rounded-xl border border-zinc-200/80 bg-white text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 shadow-2xs transition-colors"
      : variant === "primary"
      ? "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-semibold shadow-xs transition-colors"
      : "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-200/80 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 text-xs font-medium shadow-2xs transition-colors";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${baseStyle} ${className}`}
        title="Compartir por código QR"
      >
        <QrCode size={14} className={variant === "primary" ? "text-white" : "text-emerald-500"} />
        {variant !== "icon" && <span>Compartir QR</span>}
      </button>

      {open && (
        <ShareDialog
          item={{ id: itemId, name: itemName }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
