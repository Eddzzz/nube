"use client";

import {
  Folder,
  FolderPlus,
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  FileSpreadsheet,
  Files,
  Presentation,
  FileType2,
  FileArchive,
  FileCode,
  Download,
  FolderOpen,
  Sparkles,
  QrCode,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useI18n } from "@/i18n/I18nProvider";
import {
  getExtension,
  isAudioExtension,
  isImageExtension,
  isTextExtension,
  isMarkdownExtension,
  isPdfExtension,
  isVideoExtension,
} from "@/lib/fileTypes";
import { useEffect, useState } from "react";
import CreateFolderDialog from "./CreateFolderDialog";
import ConfirmDeleteDialog from "./ConfirmDeleteDialog";
import RenameDialog from "./RenameDialog";
import DriveItemActions from "./DriveItemActions";
import ConfirmBulkDeleteDialog from "./ConfirmBulkDeleteDialog";
import UploadButton from "./UploadButton";
import ViewModeToggle, { type ViewMode } from "./ViewModeToggle";
import type { Permission } from "@/lib/permissions";
import { ShareDialog } from "@/features/share";

export type DriveListItem = {
  id: string;
  name: string;
  folder?: object;
  file?: {
    mimeType?: string;
  };
  size: number;
  lastModifiedDateTime: string;
  permissions?: Permission[];
};

interface DriveListProps {
  items: DriveListItem[];
  basePathSegments?: string[];
  isAdmin?: boolean;
  folderPermissions?: Permission[];
  autoRefresh?: boolean;
  onDeleteSuccess?: (id: string) => void;
}

function formatSize(size: number): string {
  const KB = 1024;
  const MB = KB * 1024;
  const GB = MB * 1024;

  if (size < KB) return `${size} B`;
  if (size >= GB) return `${(size / GB).toFixed(1).replace(/\.0$/, "")} GB`;
  if (size >= MB) return `${(size / MB).toFixed(1).replace(/\.0$/, "")} MB`;
  return `${(size / KB).toFixed(1).replace(/\.0$/, "")} KB`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("es", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getFileVisualConfig(name: string, isFolder: boolean): { icon: LucideIcon; badgeClass: string; iconClass: string } {
  if (isFolder) {
    return {
      icon: Folder,
      badgeClass: "bg-amber-500/10 dark:bg-amber-500/20 border-amber-500/25 text-amber-600 dark:text-amber-400",
      iconClass: "fill-amber-500/20",
    };
  }

  const ext = getExtension(name);

  if (isPdfExtension(ext)) {
    return {
      icon: FileType2,
      badgeClass: "bg-rose-500/10 dark:bg-rose-500/20 border-rose-500/25 text-rose-600 dark:text-rose-400",
      iconClass: "",
    };
  }
  if (isTextExtension(ext) || isMarkdownExtension(ext)) {
    return {
      icon: FileText,
      badgeClass: "bg-teal-500/10 dark:bg-teal-500/20 border-teal-500/25 text-teal-600 dark:text-teal-400",
      iconClass: "",
    };
  }
  if (["xls", "xlsx", "xlsb", "xlsm", "csv", "tsv"].includes(ext)) {
    return {
      icon: FileSpreadsheet,
      badgeClass: "bg-emerald-500/10 dark:bg-emerald-500/20 border-emerald-500/25 text-emerald-600 dark:text-emerald-400",
      iconClass: "",
    };
  }
  if (["doc", "docx"].includes(ext)) {
    return {
      icon: FileText,
      badgeClass: "bg-sky-500/10 dark:bg-sky-500/20 border-sky-500/25 text-sky-600 dark:text-sky-400",
      iconClass: "",
    };
  }
  if (["ppt", "pptx", "key", "odp"].includes(ext)) {
    return {
      icon: Presentation,
      badgeClass: "bg-orange-500/10 dark:bg-orange-500/20 border-orange-500/25 text-orange-600 dark:text-orange-400",
      iconClass: "",
    };
  }
  if (["mp4", "mkv", "mov", "avi", "wmv", "webm", "flv", "mpeg", "mpg"].includes(ext) || isVideoExtension(ext)) {
    return {
      icon: FileVideo,
      badgeClass: "bg-violet-500/10 dark:bg-violet-500/20 border-violet-500/25 text-violet-600 dark:text-violet-400",
      iconClass: "",
    };
  }
  if (isAudioExtension(ext)) {
    return {
      icon: FileAudio,
      badgeClass: "bg-pink-500/10 dark:bg-pink-500/20 border-pink-500/25 text-pink-600 dark:text-pink-400",
      iconClass: "",
    };
  }
  if (isImageExtension(ext)) {
    return {
      icon: FileImage,
      badgeClass: "bg-indigo-500/10 dark:bg-indigo-500/20 border-indigo-500/25 text-indigo-600 dark:text-indigo-400",
      iconClass: "",
    };
  }
  if (["zip", "rar", "7z", "tar", "gz", "tgz", "bz2", "iso"].includes(ext)) {
    return {
      icon: FileArchive,
      badgeClass: "bg-amber-600/10 dark:bg-amber-600/20 border-amber-600/25 text-amber-700 dark:text-amber-300",
      iconClass: "",
    };
  }
  if (["js", "jsx", "ts", "tsx", "json", "yml", "yaml", "py", "rb", "go", "rs", "php", "java", "c", "cpp", "h", "hpp", "css", "scss", "html", "sh", "mdx"].includes(ext)) {
    return {
      icon: FileCode,
      badgeClass: "bg-teal-500/10 dark:bg-teal-500/20 border-teal-500/25 text-teal-600 dark:text-teal-400",
      iconClass: "",
    };
  }

  return {
    icon: Files,
    badgeClass: "bg-zinc-500/10 dark:bg-zinc-500/20 border-zinc-500/25 text-zinc-600 dark:text-zinc-400",
    iconClass: "",
  };
}

function isPreviewable(item: DriveListItem): boolean {
  if (item.folder) return false;
  const ext = getExtension(item.name);
  return (
    isImageExtension(ext) ||
    isTextExtension(ext) ||
    isMarkdownExtension(ext) ||
    isAudioExtension(ext) ||
    isPdfExtension(ext) ||
    isVideoExtension(ext) ||
    Boolean(item.file?.mimeType?.startsWith("image/")) ||
    Boolean(item.file?.mimeType?.startsWith("audio/")) ||
    Boolean(item.file?.mimeType?.startsWith("text/"))
  );
}

export default function DriveList({
  items,
  basePathSegments = [],
  isAdmin = false,
  folderPermissions = [],
  autoRefresh = true,
  onDeleteSuccess,
}: DriveListProps) {
  const { t } = useI18n();
  const [localItems, setLocalItems] = useState(items);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [deleteDialogItem, setDeleteDialogItem] = useState<DriveListItem | null>(null);
  const [deleteDialogError, setDeleteDialogError] = useState<string | null>(null);
  const [renameDialogItem, setRenameDialogItem] = useState<DriveListItem | null>(null);
  const [renameDialogError, setRenameDialogError] = useState<string | null>(null);
  const [shareDialogItem, setShareDialogItem] = useState<DriveListItem | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkDeleteError, setBulkDeleteError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [currentPermissions, setCurrentPermissions] = useState(folderPermissions);
  const [syncError, setSyncError] = useState("");
  const [archiveError, setArchiveError] = useState("");
  const [archiving, setArchiving] = useState(false);

  const currentFolderId = basePathSegments.at(-1);
  const allow = (permission: Permission, item?: DriveListItem) =>
    isAdmin || (item?.permissions ?? currentPermissions).includes(permission);
  const canSelect = (item: DriveListItem) => allow("download", item) || allow("delete", item);
  const canSelectAny = localItems.some(canSelect);

  const isSelecting = selectionMode || selectedIds.length > 0;
  const selectedItems = localItems.filter((item) => selectedIds.includes(item.id));
  const selectedCount = selectedItems.length;
  const allSelected = selectedCount > 0 && selectedCount === localItems.filter(canSelect).length;
  const canDeleteSelected = selectedCount > 0 && selectedItems.every((item) => allow("delete", item));
  const canDownloadSelected = selectedCount > 0 && selectedItems.every((item) => allow("download", item));

  useEffect(() => {
    setLocalItems(items);
  }, [items]);

  useEffect(() => {
    setCurrentPermissions(folderPermissions);
  }, [folderPermissions]);

  useEffect(() => {
    if (!autoRefresh) return;
    let active = true;
    let inFlight = false;
    let controller: AbortController | undefined;

    async function refresh() {
      if (document.visibilityState !== "visible" || inFlight) return;
      inFlight = true;
      controller = new AbortController();
      try {
        const query = currentFolderId ? `?parentId=${encodeURIComponent(currentFolderId)}` : "";
        const response = await fetch(`/api/onedrive/list${query}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (response.status === 401) {
          window.location.assign("/login");
          return;
        }
        if (!response.ok) {
          if (response.status === 403 && active) setLocalItems([]);
          throw new Error(await response.text());
        }
        const data = (await response.json()) as { value: DriveListItem[]; permissions: Permission[] };
        if (active) {
          setLocalItems((previous) =>
            JSON.stringify(previous) === JSON.stringify(data.value) ? previous : data.value
          );
          setCurrentPermissions(data.permissions);
          setSyncError("");
        }
      } catch (error) {
        if (active && !(error instanceof DOMException && error.name === "AbortError")) {
          setSyncError("No se pudo actualizar el listado. Se reintentará automáticamente.");
        }
      } finally {
        inFlight = false;
      }
    }

    const interval = setInterval(() => void refresh(), 10000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      active = false;
      clearInterval(interval);
      controller?.abort();
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [autoRefresh, currentFolderId]);

  useEffect(() => {
    setSelectedIds((prev) =>
      prev.filter((id) =>
        localItems.some(
          (entry) =>
            entry.id === id &&
            (isAdmin || entry.permissions?.includes("download") || entry.permissions?.includes("delete"))
        )
      )
    );
  }, [localItems, isAdmin]);

  useEffect(() => {
    if (isSelecting && openMenuId) {
      setOpenMenuId(null);
    }
  }, [isSelecting, openMenuId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("driveViewMode");
    if (stored === "list" || stored === "grid") {
      setViewMode(stored);
    } else if (stored) {
      localStorage.removeItem("driveViewMode");
    }
  }, []);

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    if (typeof window !== "undefined") {
      localStorage.setItem("driveViewMode", mode);
    }
  };

  const handleSelectionModeToggle = () => {
    if (isSelecting) {
      setSelectionMode(false);
      setSelectedIds([]);
      setBulkDeleteError(null);
    } else {
      setSelectionMode(true);
    }
  };

  const toggleSelection = (id: string) => {
    const item = localItems.find((entry) => entry.id === id);
    if (!item || !canSelect(item)) return;
    setSelectionMode(true);
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectionMode(true);
      setSelectedIds(localItems.filter(canSelect).map((entry) => entry.id));
    }
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
  };

  const handleCreateFolder = async (name: string): Promise<boolean> => {
    const parentId = currentFolderId;
    setCreating(true);
    setDialogError(null);
    try {
      const response = await fetch("/api/onedrive/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, parentId }),
      });

      if (!response.ok) {
        const message = await response.text().catch(() => response.statusText);
        throw new Error(message);
      }

      const created = (await response.json()) as DriveListItem;
      setLocalItems((prev) => [created, ...prev]);
      setDialogOpen(false);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error ?? "desconocido");
      setDialogError(t("folder.error", { message }));
      return false;
    } finally {
      setCreating(false);
    }
  };

  const performDelete = async (item: DriveListItem) => {
    setDeletingId(item.id);
    setDeleteDialogError(null);
    try {
      const response = await fetch(`/api/onedrive/items/${item.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const message = await response.text().catch(() => response.statusText);
        throw new Error(message);
      }
      setLocalItems((prev) => prev.filter((entry) => entry.id !== item.id));
      onDeleteSuccess?.(item.id);
      setDeleteDialogItem(null);
      setOpenMenuId(null);
      setSelectedIds((prev) => prev.filter((value) => value !== item.id));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error ?? "desconocido");
      setDeleteDialogError(t("delete.error", { message }));
    } finally {
      setDeletingId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteDialogItem) return;
    await performDelete(deleteDialogItem);
  };

  const handleBulkDelete = async () => {
    if (!canDeleteSelected) return;
    const idsToDelete = [...selectedIds];
    setBulkDeleting(true);
    setBulkDeleteError(null);

    const failures: Array<{ name: string; message: string }> = [];

    for (const id of idsToDelete) {
      const item = localItems.find((entry) => entry.id === id);
      if (!item) {
        setSelectedIds((prev) => prev.filter((value) => value !== id));
        continue;
      }

      try {
        const response = await fetch(`/api/onedrive/items/${id}`, {
          method: "DELETE",
        });
        if (!response.ok) {
          const message = await response.text().catch(() => response.statusText);
          throw new Error(message);
        }

        setLocalItems((prev) => prev.filter((entry) => entry.id !== id));
        setSelectedIds((prev) => prev.filter((value) => value !== id));
        onDeleteSuccess?.(id);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error ?? "desconocido");
        failures.push({ name: item.name, message });
      }
    }

    if (failures.length > 0) {
      const names = failures
        .map((entry) => `${entry.name} (${entry.message})`)
        .join("、");
      setBulkDeleteError(t("bulk.delete.error", { names }));
    } else {
      setBulkDialogOpen(false);
      setSelectionMode(false);
      setSelectedIds([]);
    }

    setBulkDeleting(false);
  };

  const handleUploadSuccess = (item: DriveListItem) => {
    setLocalItems((prev) => {
      const filtered = prev.filter((entry) => entry.id !== item.id);
      return [{ ...item, permissions: currentPermissions }, ...filtered];
    });
  };

  const downloadArchive = async () => {
    if (!canDownloadSelected || archiving) return;
    setArchiving(true);
    setArchiveError("");
    try {
      const response = await fetch("/api/onedrive/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedItems.map((item) => item.id) }),
      });
      if (!response.ok) throw new Error(await response.text());
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = "archivos-compartidos.zip";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setArchiveError(error instanceof Error ? error.message : "No se pudo descargar el ZIP");
    } finally {
      setArchiving(false);
    }
  };

  const handleRename = async (name: string): Promise<boolean> => {
    if (!renameDialogItem) return false;
    setRenaming(true);
    setRenameDialogError(null);
    try {
      const response = await fetch(`/api/onedrive/items/${renameDialogItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) {
        const message = await response.text().catch(() => response.statusText);
        throw new Error(message);
      }

      const updated = (await response.json()) as DriveListItem;
      setLocalItems((prev) =>
        prev.map((entry) => (entry.id === renameDialogItem.id ? { ...entry, ...updated } : entry))
      );
      setRenameDialogItem(null);
      setOpenMenuId(null);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error ?? "desconocido");
      setRenameDialogError(t("rename.error", { message }));
      return false;
    } finally {
      setRenaming(false);
    }
  };

  return (
    <>
      {syncError && <p role="status" className="workspace-error">{syncError}</p>}
      {archiveError && <p role="alert" className="workspace-error">{archiveError}</p>}

      {/* Main Action Bar */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <ViewModeToggle viewMode={viewMode} onViewModeChange={handleViewModeChange} />

          {canSelectAny && (
            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleSelectionModeToggle}
              disabled={bulkDeleting}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors shadow-2xs ${
                isSelecting
                  ? "bg-emerald-500/15 border border-emerald-500/40 text-emerald-600 dark:text-emerald-400 dark:bg-emerald-500/25"
                  : "liquid-glass-pill text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              <span>{isSelecting ? t("bulk.select.exit") : t("bulk.select.enter")}</span>
            </motion.button>
          )}

          {canSelectAny && isSelecting && localItems.length > 0 && (
            <>
              <button
                type="button"
                onClick={handleSelectAll}
                className="inline-flex items-center gap-1 rounded-xl liquid-glass-pill px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
                disabled={!localItems.length}
              >
                {allSelected ? t("bulk.select.none") : t("bulk.select.all")}
              </button>
              {selectedCount > 0 && (
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="inline-flex items-center gap-1 rounded-xl liquid-glass-pill px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
                >
                  {t("bulk.select.clear")}
                </button>
              )}
              {selectedCount > 0 && (
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
                  {t("bulk.selected.count", { count: selectedCount })}
                </span>
              )}
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {allow("upload") && (
            <UploadButton
              parentId={currentFolderId ?? undefined}
              disabled={creating || bulkDeleting}
              onSuccess={handleUploadSuccess}
            />
          )}

          {allow("create") && (
            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                setDialogError(null);
                setDialogOpen(true);
              }}
              disabled={creating}
              className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FolderPlus size={15} />
              <span>{t("folder.create")}</span>
            </motion.button>
          )}
        </div>
      </div>

      {/* Empty State */}
      {!localItems.length && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="my-12 py-16 px-6 text-center rounded-3xl liquid-glass flex flex-col items-center justify-center max-w-lg mx-auto"
        >
          <div className="w-16 h-16 rounded-2xl bg-zinc-100/80 dark:bg-zinc-800/80 flex items-center justify-center text-zinc-400 dark:text-zinc-500 mb-4 shadow-inner">
            <FolderOpen size={30} strokeWidth={1.5} />
          </div>
          <h3 className="text-base font-semibold text-zinc-800 dark:text-zinc-200">
            Carpeta sin archivos
          </h3>
          <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400 max-w-xs leading-relaxed">
            {isAdmin
              ? "Sube tus primeros archivos o crea una subcarpeta para comenzar la organización."
              : "No hay archivos disponibles en esta carpeta actualmente."}
          </p>
        </motion.div>
      )}

      {/* List View */}
      {viewMode === "list" && localItems.length > 0 && (
        <ul className="space-y-2">
          {localItems.map((item, idx) => {
            const newPathSegments = [...basePathSegments, item.id];
            const href = `/files/${newPathSegments.join("/")}`;
            const isFolder = Boolean(item.folder);
            const visual = getFileVisualConfig(item.name, isFolder);
            const Icon = visual.icon;
            const actionsOpen = openMenuId === item.id;
            const isSelected = selectedIds.includes(item.id);
            const previewable = isPreviewable(item);

            const rowClasses = [
              "relative flex items-center gap-3.5 px-4 py-3 rounded-2xl border transition-all duration-150 group",
              actionsOpen ? "z-40" : "",
              isSelected
                ? "bg-emerald-500/10 border-emerald-500/50 dark:bg-emerald-950/40 dark:border-emerald-500/60 ring-1 ring-emerald-500/30 cursor-pointer hover:bg-emerald-500/15 dark:hover:bg-emerald-900/40 backdrop-blur-md"
                : isSelecting
                ? "bg-zinc-50/70 dark:bg-zinc-900/50 border-zinc-200/70 dark:border-zinc-800/80 hover:bg-zinc-100/80 dark:hover:bg-zinc-800/80 cursor-pointer backdrop-blur-md"
                : "liquid-glass-row cursor-default",
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <motion.li
                key={item.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 28, delay: Math.min(idx * 0.02, 0.3) }}
                whileHover={isSelecting ? undefined : { scale: 1.004 }}
                className={rowClasses}
                onClick={isSelecting ? () => toggleSelection(item.id) : undefined}
              >
                {/* Selection checkbox or Icon badge */}
                <div className="flex items-center gap-3 shrink-0">
                  {isSelecting ? (
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={!canSelect(item)}
                      onChange={() => toggleSelection(item.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-4 w-4 rounded-md border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-emerald-600 focus:ring-emerald-500 accent-emerald-600 cursor-pointer"
                      aria-label={t("bulk.select.item", { name: item.name })}
                    />
                  ) : null}

                  <span className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${visual.badgeClass}`}>
                    <Icon size={18} className={visual.iconClass} />
                  </span>
                </div>

                {/* Name / Link */}
                <div className="flex-1 min-w-0 pr-2">
                  {isSelecting ? (
                    <span className="truncate block text-xs sm:text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {item.name}
                    </span>
                  ) : isFolder ? (
                    <Link
                      href={href}
                      className="truncate block text-xs sm:text-sm font-medium text-zinc-900 hover:text-emerald-600 dark:text-zinc-100 dark:hover:text-emerald-400 transition-colors"
                    >
                      {item.name}
                    </Link>
                  ) : (
                    <a
                      href={previewable ? `/preview/${item.id}` : allow("download", item) ? `/api/onedrive/download/${item.id}` : `/versions/${item.id}`}
                      className="truncate block text-xs sm:text-sm font-medium text-zinc-900 hover:text-emerald-600 dark:text-zinc-100 dark:hover:text-emerald-400 transition-colors"
                    >
                      {item.name}
                    </a>
                  )}
                </div>

                {/* Quick actions (Preview & Versions) */}
                {!isSelecting && (
                  <div className="hidden sm:flex items-center gap-1.5 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                    {previewable && (
                      <Link
                        href={`/preview/${item.id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-zinc-100 hover:bg-zinc-200/80 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors"
                      >
                        <Sparkles size={12} className="text-emerald-500" />
                        <span>{t("preview")}</span>
                      </Link>
                    )}

                    {allow("share", item) && (
                      <button
                        type="button"
                        onClick={() => setShareDialogItem(item)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 transition-colors"
                        title="Compartir por código QR"
                      >
                        <QrCode size={13} />
                        <span>Compartir</span>
                      </button>
                    )}

                    {!isFolder && (allow("versions", item) || allow("upload", item)) && (
                      <Link
                        href={`/versions/${item.id}`}
                        className="px-2 py-1 rounded-lg text-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
                      >
                        Versiones
                      </Link>
                    )}
                  </div>
                )}

                {/* Metadata: Size & Date */}
                <div className="hidden md:flex items-center gap-4 text-xs font-mono text-zinc-500 dark:text-zinc-400 shrink-0">
                  <span className="w-16 text-right tabular-nums">{formatSize(item.size)}</span>
                  <span className="w-24 text-right tabular-nums">{formatDate(item.lastModifiedDateTime)}</span>
                </div>

                {/* More actions menu */}
                {!isSelecting && (allow("rename", item) || allow("delete", item) || allow("share", item)) && (
                  <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                    <DriveItemActions
                      canRename={allow("rename", item)}
                      canDelete={allow("delete", item)}
                      canShare={allow("share", item)}
                      onShare={() => setShareDialogItem(item)}
                      isOpen={actionsOpen}
                      disabled={deletingId === item.id || (renaming && renameDialogItem?.id === item.id)}
                      onOpen={() => setOpenMenuId(item.id)}
                      onClose={() => setOpenMenuId(null)}
                      onRename={() => {
                        setRenameDialogItem(item);
                        setRenameDialogError(null);
                      }}
                      onDelete={() => {
                        setDeleteDialogItem(item);
                        setDeleteDialogError(null);
                      }}
                    />
                  </div>
                )}
              </motion.li>
            );
          })}
        </ul>
      )}

      {/* Grid View */}
      {viewMode === "grid" && localItems.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {localItems.map((item, idx) => {
            const newPathSegments = [...basePathSegments, item.id];
            const href = `/files/${newPathSegments.join("/")}`;
            const isFolder = Boolean(item.folder);
            const visual = getFileVisualConfig(item.name, isFolder);
            const Icon = visual.icon;
            const isSelected = selectedIds.includes(item.id);
            const previewable = isPreviewable(item);

            const gridCardClasses = [
              "relative flex flex-col items-center rounded-2xl p-4 border transition-all duration-200 group text-center",
              isSelected
                ? "bg-emerald-500/10 border-emerald-500/50 dark:bg-emerald-950/40 dark:border-emerald-500/60 ring-2 ring-emerald-500/30 shadow-xs cursor-pointer hover:bg-emerald-500/15 dark:hover:bg-emerald-900/40 backdrop-blur-md"
                : isSelecting
                ? "bg-zinc-50/70 dark:bg-zinc-900/50 border-zinc-200/70 dark:border-zinc-800/80 hover:bg-zinc-100/80 dark:hover:bg-zinc-800/80 cursor-pointer backdrop-blur-md"
                : "liquid-glass-row cursor-default hover:shadow-lg",
            ]
              .filter(Boolean)
              .join(" ");

            const handleCardClick = () => {
              if (isSelecting) {
                toggleSelection(item.id);
              }
            };

            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 350, damping: 28, delay: Math.min(idx * 0.02, 0.3) }}
                whileHover={isSelecting ? undefined : { y: -3, scale: 1.01 }}
                className={gridCardClasses}
                onClick={handleCardClick}
              >
                {/* Selection checkbox */}
                {isSelecting && (
                  <div className="absolute top-2.5 left-2.5 z-10">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={!canSelect(item)}
                      onChange={() => toggleSelection(item.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-4 w-4 rounded-md border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-emerald-600 focus:ring-emerald-500 accent-emerald-600 cursor-pointer"
                      aria-label={t("bulk.select.item", { name: item.name })}
                    />
                  </div>
                )}

                {/* Top right actions menu */}
                {!isSelecting && (allow("rename", item) || allow("delete", item) || allow("share", item)) && (
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-20" onClick={(e) => e.stopPropagation()}>
                    <DriveItemActions
                      canRename={allow("rename", item)}
                      canDelete={allow("delete", item)}
                      canShare={allow("share", item)}
                      onShare={() => setShareDialogItem(item)}
                      isOpen={openMenuId === item.id}
                      disabled={deletingId === item.id || (renaming && renameDialogItem?.id === item.id)}
                      onOpen={() => setOpenMenuId(item.id)}
                      onClose={() => setOpenMenuId(null)}
                      onRename={() => {
                        setRenameDialogItem(item);
                        setRenameDialogError(null);
                      }}
                      onDelete={() => {
                        setDeleteDialogItem(item);
                        setDeleteDialogError(null);
                      }}
                    />
                  </div>
                )}

                {/* Large Icon Preview */}
                <div className={`mt-2 mb-3.5 w-14 h-14 rounded-2xl border flex items-center justify-center transition-transform group-hover:scale-108 ${visual.badgeClass}`}>
                  <Icon size={26} className={visual.iconClass} />
                </div>

                {/* Name */}
                {isSelecting ? (
                  <span className="w-full truncate text-xs font-semibold text-zinc-900 dark:text-zinc-100" title={item.name}>
                    {item.name}
                  </span>
                ) : isFolder ? (
                  <Link
                    href={href}
                    className="w-full truncate text-xs font-semibold text-zinc-900 hover:text-emerald-600 dark:text-zinc-100 dark:hover:text-emerald-400 transition-colors"
                    title={item.name}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {item.name}
                  </Link>
                ) : (
                  <a
                    href={previewable ? `/preview/${item.id}` : allow("download", item) ? `/api/onedrive/download/${item.id}` : `/versions/${item.id}`}
                    className="w-full truncate text-xs font-semibold text-zinc-900 hover:text-emerald-600 dark:text-zinc-100 dark:hover:text-emerald-400 transition-colors"
                    title={item.name}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {item.name}
                  </a>
                )}

                {/* Metadata */}
                <span className="mt-1 text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                  {formatSize(item.size)}
                </span>

                {/* Preview pill button */}
                {!isSelecting && !isFolder && (allow("versions", item) || allow("upload", item)) && (
                  <Link
                    href={`/versions/${item.id}`}
                    className="mt-2 text-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 underline underline-offset-4"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Versiones
                  </Link>
                )}
                {!isSelecting && previewable && (
                  <Link
                    href={`/preview/${item.id}`}
                    className="mt-2 inline-flex items-center gap-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Sparkles size={10} className="text-emerald-500" />
                    <span>{t("preview")}</span>
                  </Link>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Floating Bulk Selection Dock */}
      <AnimatePresence>
        {isSelecting && selectedCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 sm:gap-3 px-4 py-2.5 rounded-2xl liquid-glass-dock text-white shadow-2xl"
          >
            <div className="flex items-center gap-2 pr-2 border-r border-zinc-700/80 text-xs font-semibold">
              <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold">
                {selectedCount}
              </span>
              <span className="hidden sm:inline">seleccionados</span>
            </div>

            {canDownloadSelected && (
              <motion.button
                type="button"
                whileTap={{ scale: 0.95 }}
                onClick={() => void downloadArchive()}
                disabled={archiving}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-500 transition-colors disabled:opacity-50"
              >
                <Download size={14} />
                <span>{archiving ? "Preparando…" : "Descargar ZIP"}</span>
              </motion.button>
            )}

            {canDeleteSelected && (
              <motion.button
                type="button"
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setBulkDeleteError(null);
                  setBulkDialogOpen(true);
                }}
                disabled={bulkDeleting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-medium hover:bg-rose-500 transition-colors disabled:opacity-50"
              >
                <span>{bulkDeleting ? t("bulk.delete.deleting") : t("bulk.delete.action")}</span>
              </motion.button>
            )}

            <button
              type="button"
              onClick={handleSelectionModeToggle}
              className="text-xs text-zinc-400 hover:text-white px-2 py-1 transition-colors"
            >
              Cerrar
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dialogs */}
      {allow("create") && (
        <CreateFolderDialog
          open={isDialogOpen}
          submitting={creating}
          error={dialogError}
          onConfirm={handleCreateFolder}
          onClose={() => {
            setDialogOpen(false);
            setDialogError(null);
          }}
        />
      )}

      {deleteDialogItem && allow("delete", deleteDialogItem) && (
        <ConfirmDeleteDialog
          open={Boolean(deleteDialogItem)}
          itemName={deleteDialogItem.name}
          loading={deletingId === deleteDialogItem.id}
          error={deleteDialogError}
          onConfirm={handleConfirmDelete}
          onClose={() => {
            if (deletingId === deleteDialogItem.id) return;
            setDeleteDialogItem(null);
            setDeleteDialogError(null);
          }}
        />
      )}

      {bulkDialogOpen && selectedCount > 0 && (
        <ConfirmBulkDeleteDialog
          open={bulkDialogOpen}
          count={selectedCount}
          names={selectedItems.map((entry) => entry.name)}
          loading={bulkDeleting}
          error={bulkDeleteError}
          onConfirm={handleBulkDelete}
          onClose={() => {
            if (bulkDeleting) return;
            setBulkDialogOpen(false);
            setBulkDeleteError(null);
          }}
        />
      )}

      {renameDialogItem && allow("rename", renameDialogItem) && (
        <RenameDialog
          open={Boolean(renameDialogItem)}
          initialName={renameDialogItem.name}
          submitting={renaming}
          error={renameDialogError}
          onConfirm={handleRename}
          onClose={() => {
            if (renaming) return;
            setRenameDialogItem(null);
            setRenameDialogError(null);
          }}
        />
      )}

      {shareDialogItem && allow("share", shareDialogItem) && (
        <ShareDialog
          item={{ id: shareDialogItem.id, name: shareDialogItem.name }}
          onClose={() => setShareDialogItem(null)}
        />
      )}
    </>
  );
}
