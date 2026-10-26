"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import {
  RotateCcw,
  Trash2,
  Loader2,
  RefreshCw,
  Folder,
  FileText,
  Search,
  CheckCircle2,
  AlertTriangle
} from "lucide-react";
import { motion } from "framer-motion";
import type { RecoveryEntry } from "@/services/local-drive";
import { requestJson, localDate } from "./client";

export default function TrashPanel() {
  const [items, setItems] = useState<RecoveryEntry[] | null>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      setItems((await requestJson<{ trash: RecoveryEntry[] }>("/api/recovery")).trash);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function restore(item: RecoveryEntry) {
    setBusy(item.id);
    setError("");
    setNotice("");
    try {
      await requestJson("/api/recovery", "POST", { kind: "restoreTrash", id: item.id });
      setNotice(`Elemento recuperado exitosamente a: ${item.originalPath}`);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  const filtered = useMemo(() => {
    if (!items) return [];
    if (!query.trim()) return items;
    return items.filter((item) =>
      item.originalPath.toLowerCase().includes(query.trim().toLowerCase())
    );
  }, [items, query]);

  return (
    <div className="workspace-page max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-7 space-y-7">
      {/* Page Heading */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-zinc-200/80 dark:border-zinc-800/80">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Papelera de Recuperación
            </h1>
            {items && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 tabular-nums">
                {items.length} {items.length === 1 ? "elemento" : "elementos"}
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Restaura archivos y carpetas eliminados a su ubicación original del repositorio.
          </p>
        </div>

        <motion.button
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          className="workspace-button text-xs flex items-center gap-2 px-3.5 py-2 rounded-xl self-start sm:self-auto"
          onClick={() => {
            setError("");
            void load();
          }}
          disabled={Boolean(busy)}
        >
          <RefreshCw size={14} className={busy ? "animate-spin text-emerald-600" : "text-zinc-500"} />
          <span>Actualizar</span>
        </motion.button>
      </div>

      {/* Info notice */}
      <div className="liquid-glass p-4 rounded-xl flex items-center gap-3 text-xs text-zinc-600 dark:text-zinc-400">
        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
        <span>
          La carpeta de destino debe existir y estar libre. Si ya existe un archivo con el mismo nombre en el destino, renómbralo antes de restaurar para evitar colisiones.
        </span>
      </div>

      {/* Error & Success Alerts */}
      {error && (
        <div role="alert" className="workspace-error flex items-center gap-2 p-3.5 rounded-xl text-xs">
          <AlertTriangle size={15} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <div role="status" className="workspace-notice flex items-center gap-2 p-3.5 rounded-xl text-xs">
          <CheckCircle2 size={15} className="shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {!items && !error && (
        <div role="status" className="py-16 text-center space-y-3">
          <div className="w-8 h-8 mx-auto border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-zinc-500">Cargando elementos en papelera…</p>
        </div>
      )}

      {items && (
        <>
          {/* Filter Bar */}
          {items.length > 0 && (
            <div className="relative max-w-sm">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
              <input
                className="workspace-input pl-9 text-xs"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filtrar por ruta o nombre…"
              />
            </div>
          )}

          {/* Table */}
          <div className="liquid-glass rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                    <th className="py-3 px-4 font-semibold text-zinc-900 dark:text-zinc-100">Ubicación Original</th>
                    <th className="py-3 px-4 font-semibold text-zinc-900 dark:text-zinc-100">Tipo</th>
                    <th className="py-3 px-4 font-semibold text-zinc-900 dark:text-zinc-100">Fecha de Eliminación</th>
                    <th className="py-3 px-4 font-semibold text-zinc-900 dark:text-zinc-100 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                  {filtered.map((item) => (
                    <tr key={item.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2 min-w-0">
                          {item.folder ? (
                            <Folder size={16} className="text-amber-500 shrink-0" />
                          ) : (
                            <FileText size={16} className="text-emerald-500 shrink-0" />
                          )}
                          <span className="font-mono text-xs text-zinc-800 dark:text-zinc-200 break-all font-medium">
                            {item.originalPath}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            item.folder
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                              : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          }`}
                        >
                          {item.folder ? "Carpeta" : "Archivo"}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-zinc-500 whitespace-nowrap">
                        {localDate(item.createdAt)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.97 }}
                          className="workspace-button workspace-primary text-xs inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
                          onClick={() => void restore(item)}
                          disabled={Boolean(busy)}
                        >
                          {busy === item.id ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <RotateCcw size={13} aria-hidden="true" />
                          )}
                          <span>{busy === item.id ? "Restaurando…" : "Restaurar"}</span>
                        </motion.button>
                      </td>
                    </tr>
                  ))}

                  {!filtered.length && (
                    <tr>
                      <td colSpan={4} className="py-14 text-center">
                        <div className="flex flex-col items-center justify-center text-zinc-400 dark:text-zinc-500">
                          <Trash2 size={36} strokeWidth={1.5} className="mb-2 opacity-50 text-zinc-300 dark:text-zinc-600" />
                          <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                            {items.length ? "No hay elementos coincidentes con la búsqueda" : "La papelera está vacía"}
                          </p>
                          <p className="text-[11px] text-zinc-400 mt-0.5">
                            {items.length
                              ? "Prueba con otra palabra clave."
                              : "Los archivos o carpetas eliminados desde la aplicación aparecerán aquí."}
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
