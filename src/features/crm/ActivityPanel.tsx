"use client";

import { useMemo, useState } from "react";
import {
  RefreshCw,
  Search,
  Calendar,
  User,
  Activity as ActivityIcon,
  ChevronLeft,
  ChevronRight,
  RotateCcw
} from "lucide-react";
import { localDate } from "@/features/workspace/client";
import { useCrmData } from "./useCrmData";
import { todayLaPaz } from "./model";

export default function ActivityPanel() {
  const { data, error, loading, refresh } = useCrmData();
  const [query, setQuery] = useState("");
  const [actor, setActor] = useState("");
  const [action, setAction] = useState("");
  const [date, setDate] = useState("");
  const [page, setPage] = useState(0);

  const events = useMemo(
    () =>
      (data?.audit ?? []).filter(
        (event) =>
          (!actor || event.actor === actor) &&
          (!action || event.action === action) &&
          (!date || todayLaPaz(new Date(event.at)) === date) &&
          `${event.actor} ${event.action} ${event.target}`.toLocaleLowerCase("es").includes(query.toLocaleLowerCase("es"))
      ),
    [data, actor, action, date, query]
  );

  function reset() {
    setQuery("");
    setActor("");
    setAction("");
    setDate("");
    setPage(0);
  }

  const pageSize = 25;
  const totalPages = Math.max(1, Math.ceil(events.length / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const paginatedEvents = events.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

  const getActionBadgeClass = (actionName: string) => {
    const act = actionName.toLowerCase();
    if (act.includes("elimina") || act.includes("borr") || act.includes("revoc")) {
      return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20";
    }
    if (act.includes("sub") || act.includes("crea") || act.includes("restaur")) {
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20";
    }
    if (act.includes("inici") || act.includes("sesi") || act.includes("login")) {
      return "bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20";
    }
    if (act.includes("descarg") || act.includes("zip")) {
      return "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20";
    }
    return "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400";
  };

  return (
    <div className="workspace-page max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-7 space-y-7">
      {/* Page Heading */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-zinc-200/80 dark:border-zinc-800/80">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Historial de Actividad
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Registro de auditoría de todas las acciones del equipo, accesos y operaciones sobre archivos.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          <button
            type="button"
            className="workspace-button text-xs flex items-center gap-1.5 px-3 py-2 rounded-xl"
            disabled={loading}
            onClick={() => void refresh()}
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} aria-hidden="true" />
            <span>Actualizar</span>
          </button>
          
        </div>
      </div>

      {error && <p className="workspace-error text-xs p-3.5 rounded-xl" role="alert">{error}</p>}

      {!data && !error && (
        <div role="status" className="py-16 text-center space-y-3">
          <div className="w-8 h-8 mx-auto border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-zinc-500">Cargando eventos de auditoría…</p>
        </div>
      )}

      {data && (
        <>
          {/* Filter Bar */}
          <div className="liquid-glass p-5 rounded-2xl space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <label className="workspace-field">
                <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1">
                  <Search size={13} /> Buscar en historial
                </span>
                <input
                  className="workspace-input text-xs"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(0);
                  }}
                  placeholder="Usuario, archivo o acción…"
                />
              </label>

              <label className="workspace-field">
                <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1">
                  <User size={13} /> Usuario
                </span>
                <select
                  className="workspace-input text-xs"
                  value={actor}
                  onChange={(e) => {
                    setActor(e.target.value);
                    setPage(0);
                  }}
                >
                  <option value="">Todos los usuarios</option>
                  {[...new Set(data.audit.map((e) => e.actor))].sort().map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="workspace-field">
                <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1">
                  <ActivityIcon size={13} /> Tipo de acción
                </span>
                <select
                  className="workspace-input text-xs"
                  value={action}
                  onChange={(e) => {
                    setAction(e.target.value);
                    setPage(0);
                  }}
                >
                  <option value="">Todas las acciones</option>
                  {[...new Set(data.audit.map((e) => e.action))].sort().map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="workspace-field">
                <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1">
                  <Calendar size={13} /> Fecha (La Paz)
                </span>
                <input
                  className="workspace-input text-xs"
                  type="date"
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value);
                    setPage(0);
                  }}
                />
              </label>
            </div>

            <div className="flex items-center justify-between text-xs pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <span className="text-zinc-500 font-medium">
                <strong className="text-zinc-900 dark:text-zinc-100 tabular-nums">{events.length}</strong> eventos coincidentes
                (se conservan hasta 2.000)
              </span>

              {(query || actor || action || date) && (
                <button
                  type="button"
                  className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                  onClick={reset}
                >
                  <RotateCcw size={12} />
                  <span>Limpiar filtros</span>
                </button>
              )}
            </div>
          </div>

          {/* Activity Table */}
          <div className="liquid-glass rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                    <th className="py-3 px-4 font-semibold text-zinc-900 dark:text-zinc-100 whitespace-nowrap">Fecha y Hora</th>
                    <th className="py-3 px-4 font-semibold text-zinc-900 dark:text-zinc-100">Usuario</th>
                    <th className="py-3 px-4 font-semibold text-zinc-900 dark:text-zinc-100">Acción</th>
                    <th className="py-3 px-4 font-semibold text-zinc-900 dark:text-zinc-100">Elemento / Destino</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                  {paginatedEvents.map((event) => (
                    <tr key={event.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30 transition-colors">
                      <td className="py-3 px-4 font-mono text-[11px] text-zinc-500 whitespace-nowrap">
                        {localDate(event.at)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center font-bold text-[9px] shrink-0">
                            {event.actor.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-semibold text-zinc-800 dark:text-zinc-200">{event.actor}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${getActionBadgeClass(
                            event.action
                          )}`}
                        >
                          {event.action}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-zinc-600 dark:text-zinc-400 break-all max-w-md">
                        {event.target}
                      </td>
                    </tr>
                  ))}

                  {!paginatedEvents.length && (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-xs text-zinc-400">
                        No hay registros que coincidan con los filtros seleccionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t border-zinc-100 dark:border-zinc-800 text-xs">
                <span className="text-zinc-500">
                  Página <strong className="text-zinc-900 dark:text-zinc-100">{currentPage + 1}</strong> de{" "}
                  <strong>{totalPages}</strong>
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="workspace-button text-xs flex items-center gap-1 px-3 py-1.5 rounded-lg"
                    disabled={currentPage === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                  >
                    <ChevronLeft size={14} />
                    <span>Anterior</span>
                  </button>
                  <button
                    type="button"
                    className="workspace-button text-xs flex items-center gap-1 px-3 py-1.5 rounded-lg"
                    disabled={currentPage >= totalPages - 1}
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  >
                    <span>Siguiente</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>

          <p className="text-[11px] text-zinc-400">
            Nota: Los registros de descarga reflejan solicitudes autorizadas e iniciadas exitosamente por el servidor.
          </p>
        </>
      )}
    </div>
  );
}
