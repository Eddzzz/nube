"use client";

import Link from "next/link";
import { Activity, FolderOpen, HardDrive, Shield, Users } from "lucide-react";
import { useCrmData } from "./useCrmData";
import { localDate } from "@/features/workspace/client";

function size(bytes: number) {
  return bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(1)} GB` : `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

export default function Dashboard() {
  const { data, error } = useCrmData();
  return <div className="workspace-page crm-dashboard">
    <header className="workspace-heading"><h1>Panel de administración</h1><p className="workspace-muted">Usuarios, proyectos y actividad del repositorio. Actualización automática.</p></header>
    {error && <div role="alert" className="workspace-error">{error}</div>}
    {!data && !error && <p role="status" className="workspace-muted">Cargando el repositorio…</p>}
    {data && <>
      <nav aria-label="Administración del repositorio" className="flex flex-wrap gap-3">
        <Link href="/admin/projects" className="workspace-button workspace-primary"><FolderOpen size={16} /> Proyectos</Link>
        <Link href="/admin/users" className="workspace-button"><Users size={16} /> Usuarios</Link>
        <Link href="/admin/roles" className="workspace-button"><Shield size={16} /> Roles y permisos</Link>
        <Link href="/admin/activity" className="workspace-button"><Activity size={16} /> Historial de actividad</Link>
      </nav>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Usuarios activos", value: data.users.filter(user => user.active).length, detail: `${data.users.filter(user => user.active && user.role === "admin").length} administradores`, Icon: Users },
          { label: "Proyectos activos", value: data.projects.filter(project => project.status === "active").length, detail: `${data.projects.length} proyectos en total`, Icon: FolderOpen },
          { label: "Archivos", value: data.usage.files, detail: `${data.usage.folders} carpetas`, Icon: HardDrive },
          { label: "Espacio ocupado", value: size(data.usage.bytes), detail: `${size(data.usage.freeBytes)} libres en disco`, Icon: HardDrive },
        ].map(({ label, value, detail, Icon }) => <section key={label} className="workspace-panel"><div className="flex items-center justify-between gap-3"><h2 className="workspace-muted text-sm">{label}</h2><Icon size={19} className="text-emerald-600 dark:text-emerald-400" /></div><p className="mt-4 text-3xl font-semibold tabular-nums">{value}</p><p className="workspace-muted mt-2 text-sm">{detail}</p></section>)}
      </div>
      <div className="grid items-start gap-5 xl:grid-cols-2">
        <section className="workspace-panel"><div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">Proyectos recientes</h2><Link className="workspace-link text-sm" href="/admin/projects">Ver todos</Link></div>
          {data.projects.length ? <ul className="mt-4 divide-y divide-[var(--border)]">{[...data.projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 6).map(project => <li key={project.id} className="flex items-start gap-3 py-3"><FolderOpen size={18} className="mt-1 shrink-0 text-emerald-600 dark:text-emerald-400" /><div className="min-w-0 flex-1"><Link href="/admin/projects" className="workspace-link break-words font-medium">{project.name}</Link><p className="workspace-muted mt-1 break-all text-xs">{project.folderPath || "Sin carpeta vinculada"}</p></div><span className="workspace-badge">{project.status === "active" ? "Activo" : "Archivado"}</span></li>)}</ul> : <p className="workspace-muted py-8 text-sm">Todavía no hay proyectos. Todos los usuarios pueden crear su propia carpeta de proyecto.</p>}
        </section>
        <section className="workspace-panel"><div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">Actividad reciente</h2><Link className="workspace-link text-sm" href="/admin/activity">Ver historial</Link></div>
          {data.audit.length ? <ul className="mt-4 divide-y divide-[var(--border)]">{[...data.audit].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8).map(event => <li key={event.id} className="py-3"><p className="break-words text-sm"><span className="font-medium">{event.actor}</span> · {event.action}</p><p className="workspace-muted mt-1 break-all text-xs">{event.target}</p><time dateTime={event.at} className="workspace-muted mt-1 block text-xs">{localDate(event.at)}</time></li>)}</ul> : <p className="workspace-muted py-8 text-sm">Las operaciones del repositorio aparecerán aquí.</p>}
        </section>
      </div>
    </>}
  </div>;
}
