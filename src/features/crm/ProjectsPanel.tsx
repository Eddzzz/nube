"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  FolderKanban,
  Plus,
  Save,
  Users,
  X,
  Search,
  Folder,
  ArrowRight
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Account } from "@/lib/permissions";
import type { CrmJob, CrmProject, CrmTodo } from "@/services/workspace-store";
import { requestJson } from "@/features/workspace/client";

type Data = { projects: CrmProject[]; jobs: CrmJob[]; todos: CrmTodo[]; users: Account[] };
type Folder = { path: string; name: string };
type Draft = { id?: string; name: string; description: string; memberIds: string[]; folderPath: string; status: "active" | "archived" };
const empty = (): Draft => ({ name: "", description: "", memberIds: [], folderPath: "", status: "active" });

export default function ProjectsPanel() {
  const [data, setData] = useState<Data | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const [crm, files] = await Promise.all([
      requestJson<Data>("/api/admin/crm"),
      requestJson<{ folders: Folder[] }>("/api/admin/users"),
    ]);
    setData(crm);
    setFolders(files.folders);
  }, []);

  useEffect(() => {
    void load().catch((e: Error) => setError(e.message));
  }, [load]);

  const projects =
    data?.projects.filter(
      (project) =>
        (!status || project.status === status) &&
        `${project.name} ${project.description}`.toLocaleLowerCase("es").includes(query.trim().toLocaleLowerCase("es"))
    ) ?? [];

  function edit(project: CrmProject) {
    setDraft({
      id: project.id,
      name: project.name,
      description: project.description,
      memberIds: [...project.memberIds],
      folderPath: project.folderPath,
      status: project.status,
    });
    setError("");
    setNotice("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await requestJson("/api/admin/crm", "POST", {
        kind: "project",
        ...(draft.id ? { id: draft.id } : {}),
        name: draft.name,
        description: draft.description,
        memberIds: draft.memberIds,
        folderPath: draft.folderPath,
        status: draft.status,
      });
      await load();
      setDraft(null);
      setNotice("Proyecto e integrantes guardados exitosamente.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar el proyecto");
    } finally {
      setBusy(false);
    }
  }

  function toggleMember(id: string) {
    setDraft(
      (current) =>
        current && {
          ...current,
          memberIds: current.memberIds.includes(id)
            ? current.memberIds.filter((value) => value !== id)
            : [...current.memberIds, id],
        }
    );
  }

  const activeCount = data?.projects.filter((p) => p.status === "active").length ?? 0;
  const archivedCount = data?.projects.filter((p) => p.status === "archived").length ?? 0;

  return (
    <div className="workspace-page max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-7 space-y-7">
      {/* Page Heading */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-zinc-200/80 dark:border-zinc-800/80">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Proyectos del Equipo
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Organiza áreas de trabajo, asigna integrantes y vincula carpetas del repositorio.
          </p>
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          className="workspace-button workspace-primary text-xs flex items-center gap-2 px-3.5 py-2 rounded-xl self-start sm:self-auto"
          disabled={busy}
          onClick={() => {
            setDraft(empty());
            setError("");
            setNotice("");
          }}
        >
          <Plus size={15} aria-hidden="true" />
          <span>Nuevo proyecto</span>
        </motion.button>
      </div>

      {/* Alerts */}
      {error && (
        <p role="alert" className="workspace-error text-xs p-3.5 rounded-xl">
          {error}{" "}
          {!data && (
            <button
              className="underline ml-2 font-semibold"
              onClick={() => {
                setError("");
                void load().catch((e: Error) => setError(e.message));
              }}
            >
              Reintentar
            </button>
          )}
        </p>
      )}
      {notice && <p role="status" className="workspace-notice text-xs p-3.5 rounded-xl">{notice}</p>}

      {!data && !error && (
        <div role="status" className="py-16 text-center space-y-3">
          <div className="w-8 h-8 mx-auto border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-zinc-500">Cargando proyectos…</p>
        </div>
      )}

      {data && (
        <>
          {/* Quick Metrics Strip */}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="liquid-glass px-3.5 py-2 rounded-xl flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-zinc-500">Activos:</span>
              <strong className="text-zinc-900 dark:text-zinc-100 tabular-nums">{activeCount}</strong>
            </div>
            <div className="liquid-glass px-3.5 py-2 rounded-xl flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-zinc-400" />
              <span className="text-zinc-500">Archivados:</span>
              <strong className="text-zinc-900 dark:text-zinc-100 tabular-nums">{archivedCount}</strong>
            </div>
            <div className="liquid-glass px-3.5 py-2 rounded-xl flex items-center gap-2">
              <Users size={13} className="text-zinc-400" />
              <span className="text-zinc-500">Integrantes:</span>
              <strong className="text-zinc-900 dark:text-zinc-100 tabular-nums">{data.users.length}</strong>
            </div>
          </div>

          <div className={`grid gap-7 ${draft ? "xl:grid-cols-[minmax(0,1fr)_420px]" : ""}`}>
            {/* Project List Column */}
            <section className="min-w-0" aria-label="Lista de proyectos">
              {/* Filter Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                  <input
                    className="workspace-input pl-9 text-xs"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar por nombre o descripción…"
                  />
                </div>
                <select
                  className="workspace-input text-xs"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="">Todos los estados</option>
                  <option value="active">Solo activos</option>
                  <option value="archived">Solo archivados</option>
                </select>
              </div>

              <p className="text-xs text-zinc-500 mb-4" aria-live="polite">
                Mostrando {projects.length} de {data.projects.length} proyectos
              </p>

              {/* Projects Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {projects.map((project) => {
                  const jobs = data.jobs.filter((job) => job.projectId === project.id);
                  const todos = data.todos.filter((todo) => todo.projectId === project.id);
                  const completedTodos = todos.filter((todo) => todo.status === "completed").length;
                  const percent = todos.length ? Math.round((completedTodos / todos.length) * 100) : 0;
                  const memberAccounts = project.memberIds
                    .map((id) => data.users.find((u) => u.id === id))
                    .filter(Boolean) as Account[];

                  return (
                    <article
                      key={project.id}
                      className="liquid-glass p-5 rounded-2xl flex flex-col justify-between hover:border-emerald-500/30 transition-all duration-200 group"
                    >
                      <div>
                        {/* Header: Title and Status */}
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors break-words">
                            {project.name}
                          </h2>
                          <span
                            className={`shrink-0 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                              project.status === "active"
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
                            }`}
                          >
                            {project.status === "active" ? "Activo" : "Archivado"}
                          </span>
                        </div>

                        {/* Description */}
                        {project.description && (
                          <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2 mb-4 leading-relaxed">
                            {project.description}
                          </p>
                        )}

                        {/* Linked Folder */}
                        <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-100/60 dark:bg-zinc-900/60 px-2.5 py-1.5 rounded-lg mb-3">
                          <Folder size={13} className="text-emerald-500 shrink-0" />
                          <span className="truncate font-mono text-[11px]">
                            {project.folderPath || "Sin carpeta vinculada"}
                          </span>
                        </div>

                        {/* Members Stack */}
                        <div className="flex items-center gap-2 mb-4">
                          <div className="flex -space-x-1.5 overflow-hidden">
                            {memberAccounts.slice(0, 5).map((user) => (
                              <div
                                key={user.id}
                                title={user.name}
                                className="w-6 h-6 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-600 text-white flex items-center justify-center font-bold text-[10px] ring-2 ring-white dark:ring-zinc-900 shrink-0"
                              >
                                {user.name.charAt(0).toUpperCase()}
                              </div>
                            ))}
                          </div>
                          <span className="text-[11px] text-zinc-500">
                            {project.memberIds.length === 0
                              ? "Sin integrantes"
                              : `${project.memberIds.length} integrante${project.memberIds.length > 1 ? "s" : ""}`}
                          </span>
                        </div>
                      </div>

                      {/* Footer Stats & Actions */}
                      <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800/80 space-y-2.5">
                        {/* Progress Bar */}
                        {todos.length > 0 && (
                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px] text-zinc-500 font-medium">
                              <span>Progreso tareas</span>
                              <span className="tabular-nums font-semibold">{percent}%</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-emerald-600 transition-all duration-300"
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                          </div>
                        )}

                        <div className="flex items-center justify-between text-xs pt-1">
                          <span className="text-[11px] text-zinc-400 tabular-nums">
                            {jobs.length} trab. · {todos.length} tareas
                          </span>
                          <button
                            type="button"
                            className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                            disabled={busy}
                            onClick={() => edit(project)}
                          >
                            <span>Editar</span>
                            <ArrowRight size={12} />
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}

                {!projects.length && (
                  <div className="col-span-full liquid-glass text-center py-12 rounded-2xl">
                    <FolderKanban size={32} className="mx-auto text-zinc-300 dark:text-zinc-600 mb-3" aria-hidden="true" />
                    <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                      {data.projects.length ? "No hay proyectos con estos filtros" : "No hay proyectos registrados"}
                    </h2>
                    <p className="text-xs text-zinc-500 mt-1">
                      {data.projects.length
                        ? "Prueba cambiando el término de búsqueda o el estado."
                        : "Crea tu primer proyecto para organizar las tareas y accesos del equipo."}
                    </p>
                  </div>
                )}
              </div>
            </section>

            {/* Slide-over Form Column */}
            <AnimatePresence>
              {draft && (
                <motion.form
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ type: "spring", stiffness: 350, damping: 28 }}
                  onSubmit={(event) => void save(event)}
                  className="liquid-glass p-6 rounded-2xl self-start min-w-0 border-emerald-500/30 sticky top-20"
                  aria-label="Formulario de proyecto"
                >
                  <div className="flex items-center justify-between gap-3 pb-3 mb-5 border-b border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center gap-2">
                      <FolderKanban size={17} className="text-emerald-600" />
                      <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                        {draft.id ? "Editar Proyecto" : "Nuevo Proyecto"}
                      </h2>
                    </div>
                    <button
                      type="button"
                      className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
                      aria-label="Cerrar formulario"
                      disabled={busy}
                      onClick={() => setDraft(null)}
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <fieldset disabled={busy} className="space-y-4">
                    <label className="workspace-field">
                      <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Nombre del proyecto *</span>
                      <input
                        className="workspace-input text-xs"
                        value={draft.name}
                        required
                        maxLength={200}
                        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                        placeholder="ej. Sistema de Facturación"
                      />
                    </label>

                    <label className="workspace-field">
                      <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Descripción</span>
                      <textarea
                        className="workspace-input text-xs"
                        value={draft.description}
                        rows={3}
                        maxLength={4000}
                        onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                        placeholder="Objetivos, entregables y notas del proyecto…"
                      />
                    </label>

                    <label className="workspace-field">
                      <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Estado</span>
                      <select
                        className="workspace-input text-xs"
                        value={draft.status}
                        onChange={(e) => setDraft({ ...draft, status: e.target.value as Draft["status"] })}
                      >
                        <option value="active">Activo (en curso)</option>
                        <option value="archived">Archivado (solo lectura)</option>
                      </select>
                    </label>

                    <label className="workspace-field">
                      <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Carpeta de trabajo vinculada</span>
                      <select
                        className="workspace-input text-xs"
                        value={draft.folderPath}
                        onChange={(e) => setDraft({ ...draft, folderPath: e.target.value })}
                      >
                        <option value="">Sin carpeta vinculada</option>
                        {folders.map((folder) => (
                          <option key={folder.path} value={folder.path}>
                            {folder.path}
                          </option>
                        ))}
                        {draft.folderPath && !folders.some((folder) => folder.path === draft.folderPath) && (
                          <option value={draft.folderPath}>{draft.folderPath} (no disponible)</option>
                        )}
                      </select>
                    </label>

                    {/* Member Selection */}
                    <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                          Integrantes del proyecto ({draft.memberIds.length})
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400">
                        Solo los integrantes seleccionados podrán tener tareas y entregas asignadas en este proyecto.
                      </p>

                      <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                        {data.users
                          .filter((user) => user.active || draft.memberIds.includes(user.id))
                          .map((user) => (
                            <label
                              key={user.id}
                              className={`flex items-center justify-between p-2 rounded-xl border text-xs cursor-pointer transition-colors ${
                                draft.memberIds.includes(user.id)
                                  ? "border-emerald-500/40 bg-emerald-500/5 dark:bg-emerald-500/10 text-emerald-900 dark:text-emerald-100 font-medium"
                                  : "border-zinc-200/80 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="w-5 h-5 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center font-bold text-[9px] shrink-0">
                                  {user.name.charAt(0).toUpperCase()}
                                </div>
                                <span className="truncate">{user.name}</span>
                              </div>
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500"
                                checked={draft.memberIds.includes(user.id)}
                                onChange={() => toggleMember(user.id)}
                              />
                            </label>
                          ))}
                      </div>
                    </div>

                    {/* Submit Actions */}
                    <div className="flex gap-2.5 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                      <button
                        type="submit"
                        className="workspace-button workspace-primary text-xs flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl"
                      >
                        <Save size={14} aria-hidden="true" />
                        <span>{busy ? "Guardando…" : "Guardar proyecto"}</span>
                      </button>
                      <button
                        type="button"
                        className="workspace-button text-xs px-3.5 py-2.5 rounded-xl"
                        onClick={() => setDraft(null)}
                      >
                        Cancelar
                      </button>
                    </div>
                  </fieldset>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </>
      )}
    </div>
  );
}
