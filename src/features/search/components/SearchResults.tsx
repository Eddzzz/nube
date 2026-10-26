"use client";

import { DriveList } from "@/features/drive/client";
import type { DriveListItem } from "@/features/drive/client";
import { Search } from "lucide-react";
import { motion } from "framer-motion";
import { useI18n } from "@/i18n/I18nProvider";

interface SearchResultsProps {
  items: DriveListItem[];
  query: string;
  isAdmin?: boolean;
  onDelete?: (id: string) => void;
}

export default function SearchResults({ items, query, isAdmin = false, onDelete }: SearchResultsProps) {
  const { t } = useI18n();
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-5"
    >
      <div className="flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
        <Search className="w-4 h-4 text-emerald-500" />
        <span>{t("search.results", { query })}</span>
        <span className="text-xs font-normal text-zinc-400 dark:text-zinc-500">
          ({items.length} {items.length === 1 ? "resultado" : "resultados"})
        </span>
      </div>
      <DriveList items={items} isAdmin={isAdmin} autoRefresh={false} onDeleteSuccess={onDelete} />
    </motion.div>
  );
}
