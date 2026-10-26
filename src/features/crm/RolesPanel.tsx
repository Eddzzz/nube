"use client";

import Link from "next/link";
import {
  ShieldCheck,
  ArrowUpRight,
  Shield,
  Users,
  Check,
  Minus
} from "lucide-react";
import { PERMISSIONS, PERMISSION_LABELS } from "@/lib/permissions";
import { useCrmData } from "./useCrmData";

export default function RolesPanel() {
  const { data, error, loading, refresh } = useCrmData();

  return (
    <div className="workspace-page max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-7 space-y-7">
      {/* Page Heading */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-zinc-200/80 dark:border-zinc-800/80">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Roles y Permisos
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Políticas de seguridad, control de acceso a proyectos y permisos sobre las carpetas del repositorio.
          </p>
        </div>

        <Link
          href="/admin/users"
          className="workspace-button workspace-primary text-xs flex items-center gap-2 px-3.5 py-2 rounded-xl self-start sm:self-auto"
        >
          <ShieldCheck size={15} aria-hidden="true" />
          <span>Administrar usuarios y accesos</span>
        </Link>
      </div>

      {error && (
        <p role="alert" className="workspace-error text-xs p-3.5 rounded-xl">
          {error}{" "}
          <button onClick={() => void refresh()} className="underline ml-2 font-semibold">
            Reintentar
          </button>
        </p>
      )}

      {loading && !data && (
        <div role="status" className="py-16 text-center space-y-3">
          <div className="w-8 h-8 mx-auto border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-zinc-500">Cargando roles y políticas…</p>
        </div>
      )}

      {data && (
        <>
          {/* Role Comparison Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Administrator Role Card */}
            <div className="liquid-glass p-6 rounded-2xl flex flex-col justify-between border-emerald-500/20">
              <div>
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                      <Shield size={18} />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Administrador</h2>
                      <span className="text-[10px] text-zinc-400">Acceso Total al Sistema</span>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {data.users.filter((user) => user.role === "admin" && user.active).length} activos
                  </span>
                </div>

                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">
                  Tiene control integral sobre el repositorio, creación de cuentas, revocación de sesiones, todos los archivos del repositorio, papelera y restauración.
                </p>

                <ul className="space-y-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                  <li className="flex items-center gap-2">
                    <Check size={14} className="text-emerald-500 shrink-0" />
                    <span>Control de proyectos, usuarios y archivos</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={14} className="text-emerald-500 shrink-0" />
                    <span>Gestión de credenciales y permisos por carpeta</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={14} className="text-emerald-500 shrink-0" />
                    <span>Acceso de lectura y escritura a toda la unidad</span>
                  </li>
                </ul>
              </div>

              <p className="text-[11px] text-zinc-400 pt-4 mt-4 border-t border-zinc-100 dark:border-zinc-800">
                El administrador principal está protegido por variables de entorno y no puede ser eliminado desde la web.
              </p>
            </div>

            {/* Standard User Role Card */}
            <div className="liquid-glass p-6 rounded-2xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 flex items-center justify-center font-bold">
                      <Users size={18} />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Usuario del Equipo</h2>
                      <span className="text-[10px] text-zinc-400">Acceso Basado en Asignaciones</span>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 tabular-nums">
                    {data.users.filter((user) => user.role === "user" && user.active).length} activos
                  </span>
                </div>

                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">
                  Crea sus proyectos y accede a las carpetas que se compartan con su cuenta. No tiene acceso al panel de administración general.
                </p>

                <ul className="space-y-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                  <li className="flex items-center gap-2">
                    <Check size={14} className="text-emerald-500 shrink-0" />
                    <span>Crea proyectos y consulta los que compartan con su cuenta</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={14} className="text-emerald-500 shrink-0" />
                    <span>Puede subir y descargar en carpetas con permiso concedido</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Minus size={14} className="text-zinc-400 shrink-0" />
                    <span className="text-zinc-400">Sin acceso al módulo de administración (/admin)</span>
                  </li>
                </ul>
              </div>

              <p className="text-[11px] text-zinc-400 pt-4 mt-4 border-t border-zinc-100 dark:border-zinc-800">
                Los permisos de edición sobre una carpeta nunca otorgan privilegios administrativos sobre el sistema.
              </p>
            </div>
          </div>

          {/* Permissions Matrix */}
          <section className="liquid-glass p-6 rounded-2xl">
            <div className="pb-3 mb-5 border-b border-zinc-100 dark:border-zinc-800">
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Matriz de Permisos por Carpeta
              </h2>
              <p className="text-xs text-zinc-500 mt-1">
                Los permisos se evalúan jerárquicamente: las asignaciones más profundas tienen precedencia sobre las carpetas padre.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800">
                    <th className="py-2.5 px-3 font-semibold text-zinc-900 dark:text-zinc-100">Operación</th>
                    <th className="py-2.5 px-3 font-semibold text-zinc-900 dark:text-zinc-100">Solo Lectura</th>
                    <th className="py-2.5 px-3 font-semibold text-zinc-900 dark:text-zinc-100">Editor</th>
                    <th className="py-2.5 px-3 font-semibold text-zinc-900 dark:text-zinc-100">Administrador</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 font-mono">
                  {PERMISSIONS.map((permission) => (
                    <tr key={permission} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30">
                      <td className="py-2.5 px-3 font-sans font-medium text-zinc-800 dark:text-zinc-200">
                        {PERMISSION_LABELS[permission]}
                      </td>
                      <td className="py-2.5 px-3">
                        {permission === "read" || permission === "download" ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                            <Check size={13} /> Permitido
                          </span>
                        ) : (
                          <span className="text-zinc-400">-</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        {permission === "share" ? <span className="text-zinc-400">Permiso adicional</span> : <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400"><Check size={13} /> Permitido</span>}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-emerald-600 dark:text-emerald-400">
                        <span className="inline-flex items-center gap-1">
                          <Check size={13} /> Total
                        </span>
                      </td>
                    </tr>
                  ))}
                  <tr className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30">
                    <td className="py-2.5 px-3 font-sans font-medium text-zinc-800 dark:text-zinc-200">
                      Gestionar cuentas, roles y auditoría global
                    </td>
                    <td className="py-2.5 px-3 text-zinc-400">-</td>
                    <td className="py-2.5 px-3 text-zinc-400">-</td>
                    <td className="py-2.5 px-3 font-semibold text-emerald-600 dark:text-emerald-400">
                      <span className="inline-flex items-center gap-1">
                        <Check size={13} /> Total
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Account Access Review List */}
          <section className="liquid-glass p-6 rounded-2xl">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-zinc-100 dark:border-zinc-800">
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Auditoría Rápida de Accesos
              </h2>
              <Link
                href="/admin/users"
                className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
              >
                <span>Editar cuentas</span>
                <ArrowUpRight size={13} />
              </Link>
            </div>

            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {data.users.map((user) => (
                <li key={user.id} className="py-2.5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center font-bold text-xs shrink-0">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">{user.name}</p>
                      <p className="text-[11px] text-zinc-400 font-mono truncate">
                        {user.username} {!user.active ? "· Desactivado" : ""}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`shrink-0 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      user.role === "admin"
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                    }`}
                  >
                    {user.role === "admin" ? "Administrador" : `${user.grants.length} carpetas asignadas`}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
