"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight,
  CalendarDays,
  Check,
  ClipboardList,
  Plus,
  Save,
  Search,
  X,
  RotateCcw,
  Clock,
  AlertTriangle,
  BriefcaseBusiness,
  ListTodo,
  Layers
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Account } from "@/lib/permissions";
import type { CrmJob, CrmTodo, CrmProject } from "@/services/workspace-store";
import { requestJson } from "@/features/workspace/client";

type Mode = "jobs" | "tasks";
type Data = { jobs: CrmJob[]; todos: CrmTodo[]; users: Account[]; projects: CrmProject[] };
type Draft = {
  id?: string;
  title: string;
  description: string;
  assigneeId: string;
  due: string;
  status: string;
  priority: "low" | "normal" | "high";
  jobId: string;
  projectId: string;
};

const jobStatuses = {
  planned: "Planificado",
  active: "En curso",
  review: "En revisión",
  completed: "Completado",
  cancelled: "Cancelado",
};

const todoStatuses = {
  pending: "Pendiente",
  progress: "En proceso",
  completed: "Completado",
};

const priorities = { low: "Baja", normal: "Normal", high: "Alta" };
const columns = Object.entries(todoStatuses) as [CrmTodo["status"], string][];

const empty = (mode: Mode): Draft => ({
  title: "",
  description: "",
  assigneeId: "",
  due: "",
  status: mode === "jobs" ? "planned" : "pending",
  priority: "normal",
  jobId: "",
  projectId: "",
});

function today() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/La_Paz",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  return ["year", "month", "day"].map((name) => parts.find((part) => part.type === name)?.value).join("-");
}

function dateLabel(value: string) {
  return value
    ? new Intl.DateTimeFormat("es-BO", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
        new Date(`${value}T12:00:00Z`)
      )
    : "Sin fecha";
}

function draftOf(item: CrmJob | CrmTodo): Draft {
  return {
    id: item.id,
    title: item.title,
    description: "description" in item ? item.description : "",
    assigneeId: item.assigneeId,
    due: item.due,
    status: item.status,
    priority: item.priority,
    jobId: "jobId" in item ? item.jobId : "",
    projectId: item.projectId || "",
  };
}

export default function WorkPanel({ mode }: { mode: Mode }) {
  const searchParams = useSearchParams();
  const requestedNew = searchParams.get("new") === "1";
  const requestedEdit = searchParams.get("edit") || "";
  const handledShortcut = useRef("");
  const [data, setData] = useState<Data | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const statuses = mode === "jobs" ? jobStatuses : todoStatuses;

  const load = useCallback(async () => {
    const result = await requestJson<Data>("/api/admin/crm");
    setData(result);
  }, []);

  useEffect(() => {
    void load().catch((e: Error) => setError(e.message));
  }, [load]);

  useEffect(() => {
    if (!data) return;
    const shortcut = `${mode}:${requestedNew}:${requestedEdit}`;
    if (handledShortcut.current === shortcut) return;
    handledShortcut.current = shortcut;
    if (requestedNew) {
      setDraft(empty(mode));
      setError("");
    } else if (requestedEdit) {
      const item = (mode === "jobs" ? data.jobs : data.todos).find((entry) => entry.id === requestedEdit);
      if (item) {
        setDraft(draftOf(item));
        setError("");
      } else {
        setError(
          mode === "jobs"
            ? "El trabajo solicitado ya no está disponible."
            : "La tarea solicitada ya no está disponible."
        );
      }
    }
  }, [data, mode, requestedNew, requestedEdit]);

  const users = useMemo(() => new Map(data?.users.map((user) => [user.id, user]) ?? []), [data]);
  const memberLabel = (id: string) => (id ? users.get(id)?.name || "Cuenta no disponible" : "Sin asignar");
  const projectLabel = (id: string) => data?.projects.find((project) => project.id === id)?.name || "Sin proyecto";
  const overdue = (item: CrmJob | CrmTodo) =>
    Boolean(item.due && item.due < today() && item.status !== "completed" && item.status !== "cancelled");

  const matches = (item: CrmJob | CrmTodo) =>
    (!statusFilter || item.status === statusFilter) &&
    (!projectFilter || (projectFilter === "unassigned" ? !item.projectId : item.projectId === projectFilter)) &&
    (!assigneeFilter || (assigneeFilter === "unassigned" ? !item.assigneeId : item.assigneeId === assigneeFilter)) &&
    `${item.title} ${memberLabel(item.assigneeId)} ${"description" in item ? item.description : ""}`
      .toLocaleLowerCase("es")
      .includes(query.trim().toLocaleLowerCase("es"));

  const jobs = data?.jobs.filter(matches) ?? [];
  const todos = data?.todos.filter(matches) ?? [];
  const rows = mode === "jobs" ? data?.jobs ?? [] : data?.todos ?? [];
  const visibleCount = mode === "jobs" ? jobs.length : todos.length;

  function selectProject(projectId: string) {
    setDraft((current) => {
      if (!current) return current;
      const project = data?.projects.find((item) => item.id === projectId);
      const job = data?.jobs.find((item) => item.id === current.jobId);
      return {
        ...current,
        projectId,
        jobId: job?.projectId === projectId ? current.jobId : "",
        assigneeId: !projectId || project?.memberIds.includes(current.assigneeId) ? current.assigneeId : "",
      };
    });
  }

  function selectJob(jobId: string) {
    const job = data?.jobs.find((item) => item.id === jobId);
    if (!draft) return;
    const projectId = job ? job.projectId || "" : draft.projectId;
    const project = data?.projects.find((item) => item.id === projectId);
    setDraft({
      ...draft,
      jobId,
      projectId,
      assigneeId: !projectId || project?.memberIds.includes(draft.assigneeId) ? draft.assigneeId : "",
    });
  }

  function edit(item: CrmJob | CrmTodo) {
    setDraft(draftOf(item));
    setError("");
    setNotice("");
  }

  async function persist(value: Draft) {
    await requestJson("/api/admin/crm", "POST", {
      kind: mode === "jobs" ? "job" : "todo",
      ...(value.id ? { id: value.id } : {}),
      title: value.title,
      assigneeId: value.assigneeId,
      due: value.due,
      status: value.status,
      priority: value.priority,
      projectId: value.projectId,
      ...(mode === "jobs" ? { description: value.description } : { jobId: value.jobId }),
    });
    await load();
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await persist(draft);
      setDraft(null);
      setNotice(mode === "jobs" ? "Trabajo guardado con éxito." : "Tarea guardada con éxito.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function move(item: CrmTodo, status: CrmTodo["status"]) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await persist({ ...draftOf(item), status });
      if (draft?.id === item.id) setDraft((current) => current && { ...current, status });
      setNotice(`«${item.title}»: estado actualizado a ${todoStatuses[status].toLocaleLowerCase("es")}.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const openCount = rows.filter((item) => item.status !== "completed" && item.status !== "cancelled").length;
  const overdueCount = rows.filter(overdue).length;

  return (
    <div className="workspace-page max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-7 space-y-7">
      {/* Page Heading & Navigation Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-zinc-200/80 dark:border-zinc-800/80">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              {mode === "jobs" ? "Trabajos y Entregas" : "Tablero de Tareas (To do)"}
            </h1>
            {/* Quick Mode Switcher */}
            <div className="hidden sm:flex items-center p-0.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
              <Link
                href="/admin/jobs"
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  mode === "jobs"
                    ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs"
                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                }`}
              >
                Trabajos
              </Link>
              <Link
                href="/admin/tasks"
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  mode === "tasks"
                    ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs"
                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                }`}
              >
                To do
              </Link>
            </div>
          </div>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            {mode === "jobs"
              ? "Organiza entregas clave, asigna responsables y monitoriza el progreso."
              : "Gestiona las actividades operativas en un tablero ágil de pendientes, progreso y completados."}
          </p>
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          className="workspace-button workspace-primary text-xs flex items-center gap-2 px-3.5 py-2 rounded-xl self-start sm:self-auto"
          disabled={busy}
          onClick={() => {
            setDraft(empty(mode));
            setError("");
            setNotice("");
          }}
        >
          <Plus size={15} aria-hidden="true" />
          <span>{mode === "jobs" ? "Nuevo trabajo" : "Nueva tarea"}</span>
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
          <p className="text-xs text-zinc-500">Cargando {mode === "jobs" ? "trabajos" : "tareas"}…</p>
        </div>
      )}

      {data && (
        <>
          {/* Quick Metrics Bar */}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="liquid-glass px-3.5 py-2 rounded-xl flex items-center gap-2">
              <Layers size={13} className="text-zinc-400" />
              <span className="text-zinc-500">Total {mode === "jobs" ? "trabajos" : "tareas"}:</span>
              <strong className="text-zinc-900 dark:text-zinc-100 tabular-nums">{rows.length}</strong>
            </div>
            <div className="liquid-glass px-3.5 py-2 rounded-xl flex items-center gap-2">
              <Clock size={13} className="text-emerald-500" />
              <span className="text-zinc-500">Por completar:</span>
              <strong className="text-zinc-900 dark:text-zinc-100 tabular-nums">{openCount}</strong>
            </div>
            {overdueCount > 0 && (
              <div className="liquid-glass px-3.5 py-2 rounded-xl flex items-center gap-2 border-rose-500/30 bg-rose-500/5 text-rose-600 dark:text-rose-400">
                <AlertTriangle size={13} />
                <span>Vencidas:</span>
                <strong className="tabular-nums font-bold">{overdueCount}</strong>
              </div>
            )}
          </div>

          <div className={`grid gap-7 ${draft ? "2xl:grid-cols-[minmax(0,1fr)_400px]" : ""}`}>
            {/* Main Content Column */}
            <section className="min-w-0" aria-label={mode === "jobs" ? "Lista de trabajos" : "Tablero de tareas"}>
              {/* Filter Toolbar */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                  <input
                    className="workspace-input pl-9 text-xs"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar por título o persona…"
                  />
                </div>
                <select
                  className="workspace-input text-xs"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="">Todos los estados</option>
                  {Object.entries(statuses).map(([val, lbl]) => (
                    <option key={val} value={val}>
                      {lbl}
                    </option>
                  ))}
                </select>
                <select
                  className="workspace-input text-xs"
                  value={assigneeFilter}
                  onChange={(e) => setAssigneeFilter(e.target.value)}
                >
                  <option value="">Todo el equipo</option>
                  <option value="unassigned">Sin asignar</option>
                  {data.users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} {!user.active ? "(desactivado)" : ""}
                    </option>
                  ))}
                </select>
                <select
                  className="workspace-input text-xs"
                  value={projectFilter}
                  onChange={(e) => setProjectFilter(e.target.value)}
                >
                  <option value="">Todos los proyectos</option>
                  <option value="unassigned">Sin proyecto</option>
                  {data.projects.map((proj) => (
                    <option key={proj.id} value={proj.id}>
                      {proj.name} {proj.status === "archived" ? "(archivado)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <p className="text-xs text-zinc-500 mb-4" aria-live="polite">
                Mostrando {visibleCount} de {rows.length} {mode === "jobs" ? "trabajos" : "tareas"}
              </p>

              {/* Mode Jobs (Cards View) */}
              {mode === "jobs" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {jobs.map((item) => {
                    const related = data.todos.filter((todo) => todo.jobId === item.id);
                    const completed = related.filter((todo) => todo.status === "completed").length;
                    const percent = related.length ? Math.round((completed / related.length) * 100) : 0;
                    const isOverdue = overdue(item);

                    return (
                      <article
                        key={item.id}
                        className="liquid-glass p-5 rounded-2xl flex flex-col justify-between hover:border-emerald-500/30 transition-all duration-200 group"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors break-words">
                              {item.title}
                            </h2>
                            <span
                              className={`shrink-0 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                                item.status === "completed"
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                  : item.status === "active"
                                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20"
                                  : item.status === "review"
                                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                                  : item.status === "cancelled"
                                  ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
                              }`}
                            >
                              {jobStatuses[item.status]}
                            </span>
                          </div>

                          {item.description && (
                            <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2 mb-3">
                              {item.description}
                            </p>
                          )}

                          <div className="flex items-center gap-2 mb-4">
                            <span className="text-xs font-semibold px-2 py-1 rounded-md bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300">
                              {projectLabel(item.projectId)}
                            </span>
                            <span className="text-xs text-zinc-400">·</span>
                            <span className="text-xs text-zinc-500">{memberLabel(item.assigneeId)}</span>
                          </div>
                        </div>

                        {/* Progress and Footer */}
                        <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800/80 space-y-2.5">
                          {related.length > 0 && (
                            <div className="space-y-1">
                              <div className="flex justify-between text-[10px] text-zinc-500 font-medium">
                                <span>Tareas completadas</span>
                                <span className="tabular-nums font-semibold">
                                  {completed} / {related.length} ({percent}%)
                                </span>
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
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                                  item.priority === "high"
                                    ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
                                }`}
                              >
                                {priorities[item.priority]}
                              </span>
                              <span
                                className={`flex items-center gap-1 text-[11px] ${
                                  isOverdue ? "text-rose-600 font-bold" : "text-zinc-500"
                                }`}
                              >
                                <CalendarDays size={12} />
                                {dateLabel(item.due)}
                                {isOverdue ? " · Vencido" : ""}
                              </span>
                            </div>

                            <button
                              type="button"
                              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                              onClick={() => edit(item)}
                              disabled={busy}
                            >
                              Editar
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}

                  {!jobs.length && (
                    <div className="col-span-full liquid-glass text-center py-12 rounded-2xl">
                      <ClipboardList size={32} className="mx-auto text-zinc-300 dark:text-zinc-600 mb-3" />
                      <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                        {data.jobs.length ? "No hay entregas con estos filtros" : "No hay trabajos registrados"}
                      </h2>
                      <p className="text-xs text-zinc-500 mt-1">
                        {data.jobs.length
                          ? "Ajusta tus filtros de búsqueda o proyecto."
                          : "Crea una entrega y define su responsable, fecha y prioridad."}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                /* Mode Tasks (Kanban Board View) */
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                  {columns.map(([status, label]) => {
                    const list = todos.filter((todo) => todo.status === status);
                    const accentColor =
                      status === "pending"
                        ? "border-amber-500/30"
                        : status === "progress"
                        ? "border-emerald-500/30"
                        : "border-teal-500/30";

                    return (
                      <div
                        key={status}
                        className={`bg-zinc-100/50 dark:bg-zinc-900/40 border ${accentColor} rounded-2xl p-3.5 space-y-3`}
                      >
                        {/* Column Header */}
                        <div className="flex items-center justify-between pb-2 border-b border-zinc-200/60 dark:border-zinc-800 px-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                status === "pending"
                                  ? "bg-amber-500"
                                  : status === "progress"
                                  ? "bg-emerald-500"
                                  : "bg-teal-500"
                              }`}
                            />
                            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200">
                              {label}
                            </h2>
                          </div>
                          <span className="text-xs font-bold tabular-nums px-2 py-0.5 rounded-full bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 shadow-xs">
                            {list.length}
                          </span>
                        </div>

                        {/* Column Cards */}
                        <div className="space-y-3 min-h-[140px]">
                          {list.map((item) => {
                            const isOverdue = overdue(item);
                            const relatedJob = data.jobs.find((j) => j.id === item.jobId);

                            return (
                              <article
                                key={item.id}
                                className="bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800/80 p-4 rounded-xl shadow-xs hover:border-emerald-500/40 transition-colors space-y-3 group"
                              >
                                <div>
                                  <div className="flex items-center justify-between gap-2 mb-1.5">
                                    <span
                                      className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                                        item.priority === "high"
                                          ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                                          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
                                      }`}
                                    >
                                      {priorities[item.priority]}
                                    </span>

                                    <span
                                      className={`text-[10px] font-mono ${
                                        isOverdue ? "text-rose-600 font-bold" : "text-zinc-400"
                                      }`}
                                    >
                                      {dateLabel(item.due)}
                                      {isOverdue ? " (Vencida)" : ""}
                                    </span>
                                  </div>

                                  <h3 className="text-xs sm:text-sm font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors break-words">
                                    {item.title}
                                  </h3>

                                  {relatedJob && (
                                    <span className="inline-block mt-1.5 text-[10px] font-medium text-zinc-500 bg-zinc-100 dark:bg-zinc-900 px-2 py-0.5 rounded">
                                      {relatedJob.title}
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800/80 text-[11px] text-zinc-500">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <div className="w-5 h-5 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center font-bold text-[9px] shrink-0">
                                      {memberLabel(item.assigneeId).charAt(0).toUpperCase()}
                                    </div>
                                    <span className="truncate">{memberLabel(item.assigneeId)}</span>
                                  </div>

                                  <button
                                    type="button"
                                    className="text-xs font-semibold text-emerald-600 hover:underline shrink-0"
                                    onClick={() => edit(item)}
                                    disabled={busy}
                                  >
                                    Editar
                                  </button>
                                </div>

                                {/* Quick Advance Button */}
                                <div className="pt-1 flex items-center gap-2">
                                  {status === "pending" && (
                                    <button
                                      type="button"
                                      className="w-full py-1.5 px-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                                      disabled={busy}
                                      onClick={() => void move(item, "progress")}
                                    >
                                      <span>Iniciar</span>
                                      <ArrowRight size={12} />
                                    </button>
                                  )}
                                  {status === "progress" && (
                                    <button
                                      type="button"
                                      className="w-full py-1.5 px-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                                      disabled={busy}
                                      onClick={() => void move(item, "completed")}
                                    >
                                      <Check size={12} />
                                      <span>Completar</span>
                                    </button>
                                  )}
                                  {status === "completed" && (
                                    <button
                                      type="button"
                                      className="w-full py-1.5 px-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                                      disabled={busy}
                                      onClick={() => void move(item, "pending")}
                                    >
                                      <RotateCcw size={12} />
                                      <span>Reabrir</span>
                                    </button>
                                  )}
                                </div>
                              </article>
                            );
                          })}

                          {!list.length && (
                            <p className="text-center text-xs text-zinc-400 py-8">
                              Sin tareas en esta etapa.
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
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
                  aria-label={mode === "jobs" ? "Formulario de trabajo" : "Formulario de tarea"}
                >
                  <div className="flex items-center justify-between gap-3 pb-3 mb-5 border-b border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center gap-2">
                      {mode === "jobs" ? <BriefcaseBusiness size={17} className="text-emerald-600" /> : <ListTodo size={17} className="text-emerald-600" />}
                      <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                        {draft.id ? "Editar" : "Nuevo"} {mode === "jobs" ? "Trabajo" : "Tarea"}
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
                      <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Título *</span>
                      <input
                        className="workspace-input text-xs"
                        required
                        maxLength={200}
                        value={draft.title}
                        onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                        placeholder={mode === "jobs" ? "ej. Presentación y revisión final" : "ej. Verificar referencias bibliográficas"}
                      />
                    </label>

                    {mode === "jobs" && (
                      <label className="workspace-field">
                        <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Descripción detallada</span>
                        <textarea
                          className="workspace-input text-xs"
                          rows={3}
                          maxLength={4000}
                          value={draft.description}
                          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                          placeholder="Objetivo de la entrega y criterios de aceptación…"
                        />
                      </label>
                    )}

                    <label className="workspace-field">
                      <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Proyecto</span>
                      <select
                        className="workspace-input text-xs"
                        value={draft.projectId}
                        onChange={(e) => selectProject(e.target.value)}
                      >
                        <option value="">Sin proyecto específico</option>
                        {data.projects
                          .filter((p) => p.status === "active" || p.id === draft.projectId)
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} {p.status === "archived" ? "(archivado)" : ""}
                            </option>
                          ))}
                      </select>
                    </label>

                    {mode === "tasks" && (
                      <label className="workspace-field">
                        <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Trabajo relacionado</span>
                        <select
                          className="workspace-input text-xs"
                          value={draft.jobId}
                          onChange={(e) => selectJob(e.target.value)}
                        >
                          <option value="">Tarea independiente</option>
                          {data.jobs
                            .filter((job) => (job.projectId || "") === draft.projectId)
                            .map((job) => (
                              <option key={job.id} value={job.id}>
                                {job.title}
                              </option>
                            ))}
                        </select>
                      </label>
                    )}

                    <label className="workspace-field">
                      <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Responsable asignado</span>
                      <select
                        className="workspace-input text-xs"
                        value={draft.assigneeId}
                        onChange={(e) => setDraft({ ...draft, assigneeId: e.target.value })}
                      >
                        <option value="">Sin asignar</option>
                        {data.users
                          .filter(
                            (user) =>
                              (user.active || user.id === draft.assigneeId) &&
                              (!draft.projectId ||
                                data.projects.find((p) => p.id === draft.projectId)?.memberIds.includes(user.id) ||
                                user.id === draft.assigneeId)
                          )
                          .map((user) => (
                            <option key={user.id} value={user.id}>
                              {user.name} {!user.active ? "(desactivado)" : ""}
                            </option>
                          ))}
                      </select>
                    </label>

                    <label className="workspace-field">
                      <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Fecha de entrega</span>
                      <input
                        type="date"
                        className="workspace-input text-xs"
                        value={draft.due}
                        onChange={(e) => setDraft({ ...draft, due: e.target.value })}
                      />
                    </label>

                    <div className="grid grid-cols-2 gap-3">
                      <label className="workspace-field">
                        <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Estado</span>
                        <select
                          className="workspace-input text-xs"
                          value={draft.status}
                          onChange={(e) => setDraft({ ...draft, status: e.target.value })}
                        >
                          {Object.entries(statuses).map(([val, lbl]) => (
                            <option key={val} value={val}>
                              {lbl}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="workspace-field">
                        <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Prioridad</span>
                        <select
                          className="workspace-input text-xs"
                          value={draft.priority}
                          onChange={(e) => setDraft({ ...draft, priority: e.target.value as Draft["priority"] })}
                        >
                          {Object.entries(priorities).map(([val, lbl]) => (
                            <option key={val} value={val}>
                              {lbl}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <div className="flex gap-2.5 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                      <button
                        type="submit"
                        className="workspace-button workspace-primary text-xs flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl"
                      >
                        <Save size={14} aria-hidden="true" />
                        <span>{busy ? "Guardando…" : mode === "jobs" ? "Guardar trabajo" : "Guardar tarea"}</span>
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
