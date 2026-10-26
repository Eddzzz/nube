"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { UploadCloud, CheckCircle2, AlertCircle, X, RotateCcw, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useI18n } from "@/i18n/I18nProvider";
import type { DriveListItem } from "./DriveList";

type UploadButtonProps = {
  parentId?: string;
  disabled?: boolean;
  onSuccess?: (item: DriveListItem) => void;
};

type UploadStatus = "pending" | "uploading" | "success" | "error" | "canceled";

type UploadTask = {
  id: string;
  file: File;
  status: UploadStatus;
  progress: number;
  error?: string | null;
  controller?: AbortController | null;
  targetParentId?: string;
};

export default function UploadButton({ parentId, disabled = false, onSuccess }: UploadButtonProps) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const queueProcessorRef = useRef(false);
  const onSuccessRef = useRef(onSuccess);
  const [queue, setQueue] = useState<UploadTask[]>([]);
  const queueRef = useRef<UploadTask[]>([]);
  const [isMinimized, setIsMinimized] = useState(false);

  useEffect(() => {
    onSuccessRef.current = onSuccess;
  }, [onSuccess]);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  useEffect(
    () => () => {
      queueRef.current.forEach((task) => task.controller?.abort());
    },
    [],
  );

  const trigger = () => {
    if (disabled) return;
    inputRef.current?.click();
  };

  const createTaskId = () => {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  };

  const updateTask = useCallback((id: string, updater: (task: UploadTask) => UploadTask) => {
    setQueue((prev) => prev.map((task) => (task.id === id ? updater(task) : task)));
  }, []);

  const formatSize = (size: number): string => {
    const KB = 1024;
    const MB = KB * 1024;
    const GB = MB * 1024;

    if (size < KB) return `${size} B`;
    if (size >= GB) return `${(size / GB).toFixed(1).replace(/\.0$/, "")} GB`;
    if (size >= MB) return `${(size / MB).toFixed(1).replace(/\.0$/, "")} MB`;
    return `${(size / KB).toFixed(1).replace(/\.0$/, "")} KB`;
  };

  const startUpload = useCallback(
    async (task: UploadTask) => {
      const controller = new AbortController();
      const taskId = task.id;

      updateTask(taskId, (current) => ({
        ...current,
        status: "uploading",
        progress: current.progress > 0 ? current.progress : 0,
        error: null,
        controller,
      }));

      try {
        const query = new URLSearchParams({ filename: task.file.name });
        if (task.targetParentId) query.set("parentId", task.targetParentId);
        const text = await new Promise<string>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", `/api/onedrive/upload?${query}`);
          const abort = () => xhr.abort();
          const cleanup = () => controller.signal.removeEventListener("abort", abort);
          controller.signal.addEventListener("abort", abort, { once: true });
          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              updateTask(taskId, (current) => ({
                ...current,
                progress: Math.min(0.99, event.loaded / event.total),
              }));
            }
          };
          xhr.onload = () => {
            cleanup();
            if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.responseText);
            else reject(new Error(xhr.responseText || "No se pudo subir el archivo"));
          };
          xhr.onerror = () => {
            cleanup();
            reject(new Error("Se interrumpió la conexión. Comprueba la red y vuelve a intentarlo."));
          };
          xhr.onabort = () => {
            cleanup();
            reject(new DOMException("Subida cancelada", "AbortError"));
          };
          xhr.send(task.file);
        });

        const item = JSON.parse(text) as DriveListItem;
        updateTask(taskId, (current) => ({
          ...current,
          status: "success",
          progress: 1,
          controller: null,
        }));
        onSuccessRef.current?.(item);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          updateTask(taskId, (current) => ({
            ...current,
            status: "canceled",
            controller: null,
          }));
          return;
        }

        const message = error instanceof Error ? error.message : String(error ?? "desconocido");
        updateTask(taskId, (current) => ({
          ...current,
          status: "error",
          error: message,
          controller: null,
        }));
      }
    },
    [updateTask],
  );

  const handleChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files?.length) return;

    const tasks = Array.from(files).map<UploadTask>((file) => ({
      id: createTaskId(),
      file,
      status: "pending",
      progress: 0,
      error: null,
      controller: null,
      targetParentId: parentId,
    }));

    setQueue((prev) => [...prev, ...tasks]);
    setIsMinimized(false);
    event.target.value = "";
  };

  useEffect(() => {
    if (queueProcessorRef.current) return;
    const nextTask = queue.find((task) => task.status === "pending");
    if (!nextTask) return;

    queueProcessorRef.current = true;
    void (async () => {
      await startUpload(nextTask);
      queueProcessorRef.current = false;
      setQueue((prev) => [...prev]);
    })();
  }, [queue, startUpload]);

  const cancelTask = useCallback((id: string) => {
    setQueue((prev) =>
      prev.map((task) => {
        if (task.id !== id) return task;
        task.controller?.abort();
        return {
          ...task,
          status: "canceled",
          controller: null,
        };
      }),
    );
  }, []);

  const retryTask = useCallback((id: string) => {
    setQueue((prev) =>
      prev.map((task) =>
        task.id === id
          ? {
              ...task,
              status: "pending",
              progress: 0,
              error: null,
            }
          : task,
      ),
    );
  }, []);

  const removeTask = useCallback((id: string) => {
    setQueue((prev) => prev.filter((task) => task.id !== id));
  }, []);

  const activeCount = useMemo(
    () => queue.filter((task) => task.status === "pending" || task.status === "uploading").length,
    [queue],
  );

  const hasActiveUpload = activeCount > 0;

  const progressClassName = (status: UploadStatus) => {
    if (status === "success") return "bg-emerald-500";
    if (status === "error") return "bg-rose-500";
    if (status === "canceled") return "bg-zinc-400";
    return "bg-emerald-600";
  };

  const renderStatusLabel = (task: UploadTask) => {
    const percent = Math.round(task.progress * 100);
    switch (task.status) {
      case "pending":
        return t("upload.status.pending");
      case "uploading":
        return t("upload.status.uploading", { progress: percent });
      case "success":
        return t("upload.status.success");
      case "error":
        return t("upload.status.error", { message: task.error ?? "desconocido" });
      case "canceled":
        return t("upload.status.canceled");
      default:
        return "";
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleChange}
        disabled={disabled}
      />

      <motion.button
        type="button"
        onClick={trigger}
        disabled={disabled}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        className="inline-flex items-center gap-2 rounded-xl liquid-glass-pill px-3.5 py-2 text-xs font-medium text-zinc-800 dark:text-zinc-200 shadow-2xs hover:text-zinc-950 dark:hover:text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
      >
        <UploadCloud size={15} className="text-emerald-600 dark:text-emerald-400" />
        <span>{hasActiveUpload ? t("upload.uploading") : t("upload.action")}</span>
      </motion.button>

      {/* Floating Upload Queue Modal / Dock in Bottom Right */}
      <AnimatePresence>
        {queue.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 350, damping: 28 }}
            className="fixed bottom-4 right-4 z-50 w-[340px] sm:w-[380px] rounded-3xl liquid-glass shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-950/40">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100">
                  {t("upload.queue.title")}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
                  {activeCount > 0 ? `${activeCount} en curso` : `${queue.length} listos`}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  aria-label={isMinimized ? "Expandir" : "Minimizar"}
                >
                  {isMinimized ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                </button>
                {!hasActiveUpload && (
                  <button
                    type="button"
                    onClick={() => setQueue([])}
                    className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    aria-label="Cerrar lista"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
            </div>

            {/* List */}
            {!isMinimized && (
              <motion.ul
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="max-h-72 overflow-y-auto p-2.5 space-y-2 divide-y divide-zinc-100 dark:divide-zinc-800/50"
              >
                {queue.map((task) => {
                  const percent = Math.round(task.progress * 100);
                  return (
                    <li key={task.id} className="pt-2 first:pt-0">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-medium text-zinc-800 dark:text-zinc-200 truncate flex-1" title={task.file.name}>
                          {task.file.name}
                        </span>
                        <span className="text-[11px] text-zinc-400 dark:text-zinc-500 shrink-0">
                          {formatSize(task.file.size)}
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="mt-1.5 h-1.5 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                        <motion.div
                          className={`h-full rounded-full ${progressClassName(task.status)}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
                          transition={{ duration: 0.2 }}
                        />
                      </div>

                      <div className="mt-1.5 flex items-center justify-between text-[11px]">
                        <span className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
                          {task.status === "success" && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                          {task.status === "error" && <AlertCircle className="w-3.5 h-3.5 text-rose-500" />}
                          <span>{renderStatusLabel(task)}</span>
                        </span>

                        <div className="flex items-center gap-2">
                          {task.status === "uploading" && (
                            <button
                              type="button"
                              onClick={() => cancelTask(task.id)}
                              className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
                            >
                              {t("upload.cancel")}
                            </button>
                          )}
                          {(task.status === "error" || task.status === "canceled") && (
                            <button
                              type="button"
                              onClick={() => retryTask(task.id)}
                              className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 hover:underline"
                            >
                              <RotateCcw size={11} />
                              <span>{t("upload.retry")}</span>
                            </button>
                          )}
                          {(task.status === "success" || task.status === "error" || task.status === "canceled") && (
                            <button
                              type="button"
                              onClick={() => removeTask(task.id)}
                              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                            >
                              <X size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </motion.ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
