"use client";

import { useCallback, useEffect, useState } from "react";
import { History, Save, Upload, RotateCcw, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import type { RecoveryEntry } from "@/services/local-drive";
import { requestJson, localDate } from "@/features/workspace/client";

export default function VersionPanel({
  itemId,
  canManage,
  canReplace,
}: {
  itemId: string;
  canManage: boolean;
  canReplace: boolean;
}) {
  const router = useRouter();
  const [versions, setVersions] = useState<RecoveryEntry[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!canManage) return;
    try {
      const data = await requestJson<{ versions: RecoveryEntry[] }>(
        `/api/recovery?itemId=${encodeURIComponent(itemId)}`
      );
      setVersions(data.versions);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [itemId, canManage]);

  useEffect(() => {
    void load();
  }, [load]);

  async function action(kind: "snapshot" | "restoreVersion", versionId?: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await requestJson("/api/recovery", "POST", {
        kind,
        itemId,
        ...(versionId ? { versionId } : {}),
      });
      setConfirmId(null);
      setNotice(
        kind === "snapshot"
          ? "Versión guardada correctamente."
          : "Versión restaurada. El contenido anterior también se conservó."
      );
      await load();
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function replace() {
    if (!file) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/onedrive/upload?replaceId=${encodeURIComponent(itemId)}`, {
        method: "PUT",
        body: file,
      });
      if (!response.ok) throw new Error(await response.text());
      setFile(null);
      setNotice("Contenido reemplazado. Se guardó automáticamente una versión del archivo anterior.");
      await load();
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!canManage && !canReplace) return null;

  return (
    <section
      className="mt-8 border-t border-zinc-200/80 dark:border-zinc-800/80 pt-6 space-y-4"
      aria-label="Historial y reemplazo de contenido"
    >
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
            <History size={17} className="text-emerald-500" />
            <span>Versiones locales</span>
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Historial de versiones recuperables almacenadas en el servidor local.
          </p>
        </div>

        {canManage && (
          <motion.button
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            className="workspace-button text-xs"
            disabled={busy}
            onClick={() => void action("snapshot")}
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            <span>Guardar versión actual</span>
          </motion.button>
        )}
      </div>

      {error && <p role="alert" className="workspace-error text-xs">{error}</p>}
      {notice && <p role="status" className="workspace-notice text-xs">{notice}</p>}

      {canManage && (
        <div className="workspace-table-wrap">
          <table className="workspace-table">
            <thead>
              <tr>
                <th>Fecha guardada</th>
                <th>Tamaño</th>
                <th className="text-right">Acción</th>
              </tr>
            </thead>
            <tbody>
              {versions.map((version) => (
                <tr key={version.id}>
                  <td className="font-mono text-xs">{localDate(version.createdAt)}</td>
                  <td className="font-mono text-xs">{(version.size / 1024).toFixed(1)} KB</td>
                  <td className="text-right">
                    {confirmId === version.id ? (
                      <div className="inline-flex items-center justify-end gap-2">
                        <span className="text-xs text-zinc-600 dark:text-zinc-400">¿Restaurar?</span>
                        <button
                          className="workspace-button workspace-primary text-xs py-1"
                          disabled={busy}
                          onClick={() => void action("restoreVersion", version.id)}
                        >
                          Confirmar
                        </button>
                        <button
                          className="workspace-link text-xs"
                          disabled={busy}
                          onClick={() => setConfirmId(null)}
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
                        disabled={busy}
                        onClick={() => setConfirmId(version.id)}
                      >
                        <RotateCcw size={13} />
                        <span>Restaurar</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!versions.length && (
                <tr>
                  <td colSpan={3} className="text-center py-6 text-xs text-zinc-400 dark:text-zinc-500">
                    Aún no hay versiones guardadas para este archivo.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {canReplace && (
        <div className="workspace-panel p-4 space-y-3">
          <label className="workspace-field max-w-lg">
            <span className="text-xs font-semibold">Reemplazar contenido del archivo</span>
            <input
              type="file"
              className="workspace-input text-xs"
              disabled={busy}
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <span className="workspace-muted text-[11px]">
              Hasta 200 MB. Se conserva el nombre actual y se archiva una versión previa automáticamente.
            </span>
          </label>

          {file && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              className="workspace-button workspace-primary text-xs"
              disabled={busy}
              onClick={() => void replace()}
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              <span>Reemplazar con {file.name}</span>
            </motion.button>
          )}
        </div>
      )}
    </section>
  );
}
