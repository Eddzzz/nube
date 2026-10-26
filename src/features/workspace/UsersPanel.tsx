"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { UserPlus, Save, X, Search, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { PERMISSIONS, PERMISSION_LABELS, type Account, type Grant } from "@/lib/permissions";
import type { Audit } from "@/services/workspace-store";
import { requestJson, localDate } from "./client";

type Data = { users: Account[]; folders: { path: string; name: string }[]; bootstrapUsername: string; audit: Audit[] };
type Draft = { id?: string; username: string; name: string; role: "admin" | "user"; active: boolean; password: string; grants: Grant[] };
const fresh = (): Draft => ({ username: "", name: "", role: "user", active: true, password: "", grants: [] });

export default function UsersPanel({ currentId }: { currentId: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      setData(await requestJson<Data>("/api/admin/users"));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const { password, ...fields } = draft;
      const payload = draft.id
        ? {
            id: draft.id,
            name: draft.name,
            role: draft.role,
            active: draft.active,
            grants: draft.grants,
            ...(password ? { password } : {}),
          }
        : { ...fields, password };
      await requestJson("/api/admin/users", draft.id ? "PATCH" : "POST", payload);
      setDraft(null);
      setNotice(draft.id ? "Usuario y permisos guardados." : "Usuario creado. Comparte sus credenciales por un medio privado.");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function update(user: Account, change: { active?: boolean; revokeSessions?: boolean }) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await requestJson("/api/admin/users", "PATCH", { id: user.id, ...change });
      setNotice(change.revokeSessions ? `Sesiones de ${user.username} revocadas.` : "Estado del usuario actualizado.");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function setGrant(index: number, value: Grant) {
    setDraft((current) => current && ({ ...current, grants: current.grants.map((g, i) => (i === index ? value : g)) }));
  }

  const users = data?.users.filter((u) => `${u.username} ${u.name}`.toLowerCase().includes(filter.toLowerCase())) ?? [];

  return (
    <div className="workspace-page max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-7 space-y-7">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-zinc-200/80 dark:border-zinc-800/80">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Usuarios y Permisos
            </h1>
            {data && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 tabular-nums">
                {data.users.length} cuentas
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Cuentas individuales, credenciales y control de acceso a las carpetas del repositorio.
          </p>
        </div>
        <motion.button
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          className="workspace-button workspace-primary text-xs flex items-center gap-2 px-3.5 py-2 rounded-xl self-start sm:self-auto"
          onClick={() => {
            setDraft(fresh());
            setError("");
            setNotice("");
          }}
          disabled={busy}
        >
          <UserPlus size={15} aria-hidden="true" />
          <span>Crear usuario</span>
        </motion.button>
      </div>

      {error && (
        <p role="alert" className="workspace-error text-xs p-3.5 rounded-xl">
          {error}{" "}
          <button
            className="underline ml-2 font-semibold"
            onClick={() => {
              setError("");
              void load();
            }}
          >
            Reintentar
          </button>
        </p>
      )}

      {notice && <p role="status" className="workspace-notice text-xs p-3.5 rounded-xl">{notice}</p>}

      {!data && !error && (
        <div role="status" className="py-16 text-center space-y-3">
          <div className="w-8 h-8 mx-auto border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-zinc-500">Cargando usuarios…</p>
        </div>
      )}

      {data && (
        <>
          <div className="liquid-glass p-3.5 rounded-xl flex items-center gap-3 text-xs text-zinc-600 dark:text-zinc-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <span>
              {data.users.filter((u) => u.active).length} cuentas activas. Administrador principal:{" "}
              <strong className="text-zinc-900 dark:text-zinc-100 font-mono">{data.bootstrapUsername}</strong> (protegido por servidor).
            </span>
          </div>

          <div className={`grid gap-6 ${draft ? "xl:grid-cols-[minmax(0,1fr)_440px]" : ""}`}>
            <section aria-label="Cuentas del equipo" className="min-w-0">
              <div className="relative mb-4 max-w-sm">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                <input
                  className="workspace-input pl-9 text-xs"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Buscar por usuario o nombre…"
                />
              </div>

              <div className="liquid-glass rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <caption className="sr-only">Usuarios del repositorio local</caption>
                    <thead>
                      <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                        <th className="py-3 px-4 font-semibold text-zinc-900 dark:text-zinc-100">Usuario</th>
                        <th className="py-3 px-4 font-semibold text-zinc-900 dark:text-zinc-100">Acceso</th>
                        <th className="py-3 px-4 font-semibold text-zinc-900 dark:text-zinc-100">Estado</th>
                        <th className="py-3 px-4 font-semibold text-zinc-900 dark:text-zinc-100 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                      {users.map((user) => (
                        <tr key={user.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                                {user.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <strong className="block text-zinc-900 dark:text-zinc-100 truncate">{user.name}</strong>
                                <span className="block text-[11px] text-zinc-400 font-mono truncate">{user.username}</span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            {user.role === "admin" ? (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                Administrador
                              </span>
                            ) : (
                              <span className="text-xs text-zinc-600 dark:text-zinc-400">
                                {user.grants.filter((g) => g.permissions.includes("read")).length} carpetas
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                                user.active
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400"
                              }`}
                            >
                              {user.active ? "Activo" : "Desactivado"}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-2 text-xs">
                              <button
                                className="font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                                disabled={busy}
                                onClick={() => {
                                  setDraft({
                                    ...user,
                                    grants: user.grants.map((g) => ({ ...g, permissions: [...g.permissions] })),
                                    password: "",
                                  });
                                  setError("");
                                  setNotice("");
                                }}
                              >
                                Editar
                              </button>
                              <span className="text-zinc-300 dark:text-zinc-700">·</span>
                              <button
                                className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                                disabled={busy}
                                onClick={() => void update(user, { revokeSessions: true })}
                              >
                                Revocar sesiones
                              </button>
                              {user.id !== currentId && (
                                <>
                                  <span className="text-zinc-300 dark:text-zinc-700">·</span>
                                  <button
                                    className="text-zinc-400 hover:text-rose-600"
                                    disabled={busy}
                                    onClick={() => void update(user, { active: !user.active })}
                                  >
                                    {user.active ? "Desactivar" : "Activar"}
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {!users.length && (
                        <tr>
                          <td colSpan={4} className="py-12 text-center text-xs text-zinc-400">
                            {filter ? "No hay cuentas que coincidan con la búsqueda." : "Todavía no hay cuentas creadas."}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            <AnimatePresence>
              {draft && (
                <motion.form
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ type: "spring", stiffness: 350, damping: 28 }}
                  onSubmit={save}
                  className="liquid-glass p-6 rounded-2xl self-start border-emerald-500/30 sticky top-20"
                  aria-label={draft.id ? "Editar usuario" : "Crear usuario"}
                >
                  <div className="flex justify-between items-center mb-5 pb-3 border-b border-zinc-100 dark:border-zinc-800">
                    <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                      {draft.id ? "Editar cuenta" : "Nueva cuenta"}
                    </h2>
                    <button
                      type="button"
                      className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
                      aria-label="Cerrar formulario"
                      onClick={() => setDraft(null)}
                      disabled={busy}
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <fieldset disabled={busy} className="space-y-4">
                    <label className="workspace-field">
                      Nombre completo
                      <input
                        className="workspace-input text-xs"
                        value={draft.name}
                        maxLength={100}
                        required
                        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                      />
                    </label>

                    <label className="workspace-field">
                      Nombre de usuario
                      <input
                        className="workspace-input text-xs font-mono"
                        value={draft.username}
                        readOnly={Boolean(draft.id)}
                        autoComplete="off"
                        pattern="[a-zA-Z0-9][a-zA-Z0-9._\-]{2,39}"
                        minLength={3}
                        maxLength={40}
                        required
                        onChange={(e) => setDraft({ ...draft, username: e.target.value })}
                      />
                      <span className="workspace-muted text-[11px]">3 a 40 caracteres (letras, números, guiones).</span>
                    </label>

                    <label className="workspace-field">
                      {draft.id ? "Nueva contraseña (opcional)" : "Contraseña"}
                      <input
                        className="workspace-input text-xs"
                        type="password"
                        autoComplete="new-password"
                        minLength={12}
                        maxLength={128}
                        required={!draft.id}
                        value={draft.password}
                        onChange={(e) => setDraft({ ...draft, password: e.target.value })}
                      />
                      <span className="workspace-muted text-[11px]">Mínimo 12 caracteres.</span>
                    </label>

                    <label className="workspace-field">
                      Rol
                      <select
                        className="workspace-input text-xs"
                        value={draft.role}
                        disabled={draft.id === currentId}
                        onChange={(e) => setDraft({ ...draft, role: e.target.value as Draft["role"] })}
                      >
                        <option value="user">Usuario del equipo</option>
                        <option value="admin">Administrador</option>
                      </select>
                    </label>

                    {draft.id && (
                      <label className="flex gap-2 items-center text-xs font-medium cursor-pointer">
                        <input
                          type="checkbox"
                          checked={draft.active}
                          disabled={draft.id === currentId}
                          onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
                          className="rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <span>Cuenta activa</span>
                      </label>
                    )}

                    {draft.role === "admin" ? (
                      <p className="workspace-muted text-xs">
                        Los administradores gestionan todos los archivos, usuarios y permisos del repositorio.
                      </p>
                    ) : (
                      <>
                        <div className="pt-2">
                          <h3 className="font-semibold text-xs text-zinc-900 dark:text-zinc-100">Permisos por carpeta</h3>
                          <p className="workspace-muted text-[11px] mt-0.5">
                            Se heredan a su contenido. La asignación más específica prevalece.
                          </p>
                        </div>

                        {draft.grants.map((grant, index) => (
                          <fieldset
                            key={index}
                            className="border-t border-zinc-200 dark:border-zinc-800 pt-3 space-y-2.5"
                          >
                            <legend className="sr-only">Asignación {index + 1}</legend>
                            <label className="workspace-field">
                              Carpeta
                              <select
                                className="workspace-input text-xs"
                                value={grant.path}
                                onChange={(e) => setGrant(index, { ...grant, path: e.target.value })}
                              >
                                <option value="">Todo el repositorio</option>
                                {data.folders.map((f) => (
                                  <option key={f.path} value={f.path}>
                                    {f.path}
                                  </option>
                                ))}
                                {grant.path && !data.folders.some((f) => f.path === grant.path) && (
                                  <option value={grant.path}>{grant.path} (ya no existe)</option>
                                )}
                              </select>
                            </label>

                            <div className="flex flex-wrap gap-2 text-xs">
                              <button
                                type="button"
                                className="workspace-link"
                                onClick={() => setGrant(index, { ...grant, permissions: ["read", "download"] })}
                              >
                                Solo lectura
                              </button>
                              <button
                                type="button"
                                className="workspace-link"
                                onClick={() => setGrant(index, { ...grant, permissions: PERMISSIONS.filter(permission => permission !== "share") })}
                              >
                                Editor
                              </button>
                              <button
                                type="button"
                                className="workspace-link"
                                onClick={() => setGrant(index, { ...grant, permissions: [] })}
                              >
                                Bloquear
                              </button>
                              <button
                                type="button"
                                className="workspace-link text-rose-600 dark:text-rose-400"
                                onClick={() =>
                                  setDraft({
                                    ...draft,
                                    grants: draft.grants.filter((_, i) => i !== index),
                                  })
                                }
                              >
                                Quitar
                              </button>
                            </div>

                            <div className="grid gap-1.5 sm:grid-cols-2 pt-1">
                              {PERMISSIONS.map((permission) => (
                                <label className="flex items-center gap-2 text-xs" key={permission}>
                                  <input
                                    type="checkbox"
                                    className="rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
                                    checked={grant.permissions.includes(permission)}
                                    onChange={(e) => {
                                      const permissions = e.target.checked
                                        ? [...new Set([...grant.permissions, "read" as const, permission])]
                                        : permission === "read"
                                        ? []
                                        : grant.permissions.filter((p) => p !== permission);
                                      setGrant(index, { ...grant, permissions });
                                    }}
                                  />
                                  <span>{PERMISSION_LABELS[permission]}</span>
                                </label>
                              ))}
                            </div>
                          </fieldset>
                        ))}

                        <button
                          type="button"
                          className="workspace-button text-xs"
                          disabled={draft.grants.length >= 100}
                          onClick={() =>
                            setDraft({
                              ...draft,
                              grants: [...draft.grants, { path: "", permissions: ["read", "download"] }],
                            })
                          }
                        >
                          Asignar carpeta
                        </button>

                        {!draft.grants.length && (
                          <p className="workspace-muted text-[11px]">Sin asignaciones, esta cuenta no verá archivos.</p>
                        )}
                      </>
                    )}

                    <motion.button
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      className="workspace-button workspace-primary w-full justify-center text-xs mt-2"
                      type="submit"
                    >
                      {busy ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} aria-hidden="true" />}
                      <span>{busy ? "Guardando…" : "Guardar cuenta"}</span>
                    </motion.button>
                  </fieldset>
                </motion.form>
              )}
            </AnimatePresence>
          </div>

          {/* Audit trail */}
          <details className="mt-12 border-t border-zinc-200 dark:border-zinc-800 pt-6">
            <summary className="cursor-pointer text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
              Registro de auditoría · {data.audit.length} eventos registrados
            </summary>
            <div className="flex justify-between items-center gap-4 my-4">
              <p className="workspace-muted text-xs">Mostrando hasta los últimos 100 eventos.</p>
              
            </div>
            <div className="workspace-table-wrap">
              <table className="workspace-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Usuario</th>
                    <th>Acción</th>
                    <th>Elemento</th>
                  </tr>
                </thead>
                <tbody>
                  {data.audit.slice(0, 100).map((event) => (
                    <tr key={event.id}>
                      <td className="whitespace-nowrap font-mono text-xs">{localDate(event.at)}</td>
                      <td className="font-medium text-xs">{event.actor}</td>
                      <td>
                        <span className="workspace-badge font-mono text-[11px]">{event.action}</span>
                      </td>
                      <td className="break-all font-mono text-xs text-zinc-500">{event.target}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </div>
  );
}
