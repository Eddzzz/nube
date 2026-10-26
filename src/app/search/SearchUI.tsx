"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Loader2, X } from "lucide-react";
import { motion } from "framer-motion";
import { SearchResults } from "@/features/search";
import type { DriveListItem } from "@/features/drive/client";
import {
  getExtension,
  isAudioExtension,
  isImageExtension,
  isMarkdownExtension,
  isTextExtension,
} from "@/lib/fileTypes";
import { useI18n } from "@/i18n/I18nProvider";

type SortKey = "relevance" | "date_desc" | "date_asc" | "name_asc" | "size_desc" | "size_asc";
type FilterKey = "all" | "folders" | "files" | "images" | "audio" | "text" | "markdown" | "video" | "archives" | "code" | "docs" | "sheets";

function filterItem(item: DriveListItem, filter: FilterKey): boolean {
  const isFolder = Boolean(item.folder && !item.file);
  const ext = getExtension(item.name);
  switch (filter) {
    case "all":
      return true;
    case "folders":
      return isFolder;
    case "files":
      return Boolean(item.file);
    case "images":
      return Boolean(item.file && (item.file.mimeType?.startsWith("image/") || isImageExtension(ext)));
    case "audio":
      return Boolean(item.file && (item.file.mimeType?.startsWith("audio/") || isAudioExtension(ext)));
    case "text":
      return Boolean(item.file && (item.file.mimeType?.startsWith("text/") || isTextExtension(ext)));
    case "markdown":
      return Boolean(item.file && isMarkdownExtension(ext));
    case "video":
      return Boolean(item.file && ["mp4", "mkv", "mov", "avi", "wmv", "webm", "flv", "mpeg", "mpg"].includes(ext));
    case "archives":
      return Boolean(item.file && ["zip", "rar", "7z", "tar", "gz", "tgz", "bz2", "iso"].includes(ext));
    case "code":
      return Boolean(item.file && ["js", "jsx", "ts", "tsx", "json", "yml", "yaml", "py", "rb", "go", "rs", "php", "java", "c", "cpp", "h", "hpp", "css", "scss", "html", "sh", "mdx"].includes(ext));
    case "docs":
      return Boolean(item.file && ["doc", "docx", "pdf"].includes(ext));
    case "sheets":
      return Boolean(item.file && ["xls", "xlsx", "xlsb", "xlsm", "csv", "tsv"].includes(ext));
  }
}

function sortItems(items: DriveListItem[], sort: SortKey): DriveListItem[] {
  const list = [...items];
  switch (sort) {
    case "date_desc":
      return list.sort((a, b) => new Date(b.lastModifiedDateTime).getTime() - new Date(a.lastModifiedDateTime).getTime());
    case "date_asc":
      return list.sort((a, b) => new Date(a.lastModifiedDateTime).getTime() - new Date(b.lastModifiedDateTime).getTime());
    case "name_asc":
      return list.sort((a, b) => a.name.localeCompare(b.name, "es"));
    case "size_desc":
      return list.sort((a, b) => b.size - a.size);
    case "size_asc":
      return list.sort((a, b) => a.size - b.size);
    case "relevance":
    default:
      return items;
  }
}

export default function SearchUI({ isAdmin = false }: { isAdmin?: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const sp = useSearchParams();

  const [query, setQuery] = useState<string>(sp.get("q") ?? "");
  const [items, setItems] = useState<DriveListItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("date_desc");
  const [filter, setFilter] = useState<FilterKey>("all");

  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setQuery(sp.get("q") ?? "");
  }, [sp]);

  const fetchSearch = useCallback((q: string, background = false) => {
    if (abortRef.current) abortRef.current.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    if (!background) setLoading(true);
    setError(null);
    fetch(`/api/onedrive/search?q=${encodeURIComponent(q)}`, { signal: ac.signal, cache: "no-store" })
      .then(async (r) => {
        if (r.status === 401) {
          window.location.assign("/login");
          throw new Error("La sesión terminó");
        }
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      })
      .then((data: { value: DriveListItem[] }) => {
        setItems((previous) => (JSON.stringify(previous) === JSON.stringify(data.value) ? previous : data.value ?? []));
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        const msg = e instanceof Error ? e.message : "Error desconocido";
        setError(msg);
        setItems([]);
      })
      .finally(() => {
        if (!background) setLoading(false);
      });
  }, []);

  useEffect(() => {
    const initial = (sp.get("q") ?? "").trim();
    if (initial) fetchSearch(initial);
    else {
      setItems(null);
      setError(null);
    }
    return () => abortRef.current?.abort();
  }, [sp, fetchSearch]);

  useEffect(() => {
    const refresh = () => {
      const current = (sp.get("q") ?? "").trim();
      if (current && document.visibilityState === "visible") fetchSearch(current, true);
    };
    const interval = setInterval(refresh, 10000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [sp, fetchSearch]);

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  const onChange = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const next = val.trim();
      const url = next ? `/search?q=${encodeURIComponent(next)}` : "/search";
      router.replace(url);
    }, 300);
  };

  const displayed = useMemo(() => {
    const list = (items ?? []).filter((it) => filterItem(it, filter));
    return sortItems(list, sort);
  }, [items, filter, sort]);

  const handleDeleteSuccess = (id: string) => {
    setItems((prev) => (prev ? prev.filter((item) => item.id !== id) : prev));
  };

  const filtersList: [FilterKey, string][] = [
    ["all", t("filter.all")],
    ["folders", t("filter.folders")],
    ["files", t("filter.files")],
    ["images", t("filter.images")],
    ["audio", t("filter.audio")],
    ["text", t("filter.text")],
    ["markdown", t("filter.markdown")],
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 350, damping: 28 }}
        className="rounded-3xl liquid-glass p-5 sm:p-7 shadow-xl"
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500 pointer-events-none" />
            <input
              value={query}
              onChange={(e) => onChange(e.target.value)}
              placeholder={t("search.input.placeholder")}
              className="w-full pl-10 pr-9 py-2.5 rounded-2xl liquid-glass-pill text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 outline-none transition focus:border-emerald-500 focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-emerald-500/20"
            />
            {query && (
              <button
                type="button"
                onClick={() => onChange("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
                aria-label="Limpiar búsqueda"
              >
                <X size={14} />
              </button>
            )}
          </div>
          {loading && (
            <span className="inline-flex items-center gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
              <span>{t("search.loading")}</span>
            </span>
          )}
        </div>

        {/* Filter Chips & Sort Select */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800/70">
          <div className="flex flex-wrap items-center gap-1.5">
            {filtersList.map(([key, label]) => {
              const isActive = filter === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  className={`relative px-3 py-1 rounded-xl text-xs font-medium transition-all duration-150 ${
                    isActive
                      ? "text-zinc-900 dark:text-zinc-100"
                      : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-100/70 dark:hover:bg-zinc-800/50"
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeSearchFilter"
                      className="absolute inset-0 bg-zinc-200/80 dark:bg-zinc-800 rounded-xl -z-10 shadow-2xs"
                      transition={{ type: "spring", stiffness: 450, damping: 30 }}
                    />
                  )}
                  <span>{label}</span>
                </button>
              );
            })}
          </div>

          <div className="inline-flex items-center gap-2 text-xs">
            <label className="text-zinc-500 dark:text-zinc-400 font-medium">{t("sort.label")}</label>
            <select
              className="px-2.5 py-1.5 rounded-xl liquid-glass-pill text-xs text-zinc-800 dark:text-zinc-200 outline-none focus:ring-2 focus:ring-emerald-500/20"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
            >
              <option value="date_desc">{t("sort.date_desc")}</option>
              <option value="date_asc">{t("sort.date_asc")}</option>
              <option value="name_asc">{t("sort.name_asc")}</option>
              <option value="size_desc">{t("sort.size_desc")}</option>
              <option value="size_asc">{t("sort.size_asc")}</option>
              <option value="relevance">{t("sort.relevance")}</option>
            </select>
          </div>
        </div>

        {/* Results Area */}
        <div className="mt-6">
          {error ? (
            <p className="workspace-error" role="alert">{error}</p>
          ) : query.trim() === "" ? (
            <p className="text-xs text-zinc-400 dark:text-zinc-500 text-center py-12">{t("search.tip.enter")}</p>
          ) : items && items.length === 0 ? (
            <p className="text-xs text-zinc-400 dark:text-zinc-500 text-center py-12">{t("search.tip.none")}</p>
          ) : items ? (
            <SearchResults
              items={displayed}
              query={query.trim()}
              isAdmin={isAdmin}
              onDelete={handleDeleteSuccess}
            />
          ) : null}
        </div>
      </motion.div>
    </div>
  );
}
