"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Archive, Folder, FolderOpen, FolderPlus, LayoutGrid, List, QrCode, Search, Settings2, Users, X } from "lucide-react";
import { ShareDialog, type ShareItem } from "@/features/share";
import { requestJson } from "./client";

type Person = { id: string; name: string; username: string };
type Access = { userId: string; role: "reader" | "editor" };
type Project = {
  id: string; name: string; description: string; folderPath: string;
  status: "active" | "archived"; ownerId: string; canManage: boolean;
  role: "owner" | "reader" | "editor" | "admin";
  members: (Access & { name: string; username: string })[];
};
type Data = { projects: Project[]; people: Person[] };
const roles = { owner: "Propietario", reader: "Solo lectura", editor: "Puede editar", admin: "Administrador" };

function folderId(path: string) {
  return btoa(Array.from(new TextEncoder().encode(path), byte => String.fromCharCode(byte)).join(""))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export default function ProjectPanel() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [template, setTemplate] = useState(true);
  const [query, setQuery] = useState("");
  const [shared, setShared] = useState(false);
  const [archived, setArchived] = useState(false);
  const [list, setList] = useState(false);
  const [sharing, setSharing] = useState<string | null>(null);
  const [access, setAccess] = useState<Access[]>([]);
  const [qr, setQr] = useState<ShareItem | null>(null);

  const load = useCallback(async () => {
    try { setData(await requestJson<Data>("/api/projects")); }
    catch (cause) { setError((cause as Error).message); }
  }, []);

  useEffect(() => {
    void load();
    const refresh = () => { if (document.visibilityState === "visible") void load(); };
    const timer = window.setInterval(refresh, 15000);
    window.addEventListener("focus", refresh);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [load]);

  useEffect(() => {
    if (sharing) document.getElementById("project-access")?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [sharing]);

  async function mutate(body: unknown, method: "POST" | "PATCH", success: string) {
    setBusy(true); setError(""); setNotice("");
    try {
      await requestJson("/api/projects", method, body);
      setNotice(success); setForm(null); setSharing(null);
      await load();
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }

  function saveProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void mutate(form === "new" ? { name, description, template } : { id: form, name, description }, form === "new" ? "POST" : "PATCH", form === "new" ? "Proyecto y carpeta creados." : "Proyecto actualizado.");
  }

  function openForm(project?: Project) {
    setName(project?.name ?? ""); setDescription(project?.description ?? ""); setTemplate(true);
    setForm(project?.id ?? "new"); setSharing(null);
  }

  function share(project: Project) {
    setSharing(project.id); setForm(null);
    setAccess(project.members.filter(member => member.userId !== project.ownerId).map(({ userId, role }) => ({ userId, role })));
  }

  const projects = (data?.projects ?? []).filter(project =>
    (archived || project.status === "active") && (!shared || ["reader", "editor"].includes(project.role)) &&
    `${project.name} ${project.description} ${project.folderPath}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())
  );
  const sharingProject = data?.projects.find(project => project.id === sharing);

  return <div className="workspace-page">
    <header className="workspace-heading flex flex-wrap items-start justify-between gap-4">
      <div><h1>Proyectos</h1><p className="workspace-muted">Carpetas de trabajo con acceso para las personas que elijas.</p></div>
      <button className="workspace-button workspace-primary" onClick={() => openForm()}><FolderPlus size={17} /> Nuevo proyecto</button>
    </header>
    {error && <div className="workspace-error" role="alert">{error}</div>}
    {notice && <div className="workspace-notice" role="status">{notice}</div>}
    {form && <section className="workspace-panel">
      <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">{form === "new" ? "Nueva carpeta de proyecto" : "Editar proyecto"}</h2><button aria-label="Cerrar formulario" className="workspace-button" onClick={() => setForm(null)} disabled={busy}><X size={17} /></button></div>
      <form onSubmit={saveProject} className="mt-4"><fieldset disabled={busy} className="grid gap-4">
        <label className="workspace-field">Nombre<input type="text" name="project-name" className="workspace-input" value={name} onChange={event => setName(event.target.value)} required maxLength={120} autoFocus /></label>
        <label className="workspace-field">Descripción<textarea className="workspace-input" value={description} onChange={event => setDescription(event.target.value)} rows={2} maxLength={2000} /></label>
        {form === "new" ? <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={template} onChange={event => setTemplate(event.target.checked)} className="mt-1" /><span>Crear las cinco carpetas académicas<span className="workspace-muted mt-1 block">Planificación, fuentes, trabajo colaborativo, evidencias y entrega final. Desmárcalo para comenzar con una carpeta vacía.</span></span></label> : <p className="workspace-muted text-sm">Cambiar el nombre del proyecto no mueve ni renombra su carpeta local.</p>}
        <div><button type="submit" className="workspace-button workspace-primary">{busy ? "Guardando…" : form === "new" ? "Crear proyecto" : "Guardar cambios"}</button></div>
      </fieldset></form>
    </section>}
    <div className="flex flex-wrap items-center gap-3">
      <label className="relative min-w-48 flex-1"><Search size={17} className="pointer-events-none absolute left-3 top-3 opacity-50" /><input aria-label="Buscar proyectos" className="workspace-input w-full" style={{ paddingLeft: "2.5rem" }} placeholder="Buscar una carpeta o proyecto…" value={query} onChange={event => setQuery(event.target.value)} /></label>
      <select aria-label="Filtrar proyectos" className="workspace-input" style={{ width: "auto", maxWidth: "100%" }} value={shared ? "shared" : "all"} onChange={event => setShared(event.target.value === "shared")}><option value="all">Todos mis proyectos</option><option value="shared">Compartido conmigo</option></select>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={archived} onChange={event => setArchived(event.target.checked)} /> Ver archivados</label>
      <div className="flex gap-1"><button className="workspace-button" aria-label="Vista de tarjetas" aria-pressed={!list} onClick={() => setList(false)}><LayoutGrid size={17} /></button><button className="workspace-button" aria-label="Vista de lista" aria-pressed={list} onClick={() => setList(true)}><List size={17} /></button></div>
    </div>
    <p className="workspace-muted text-sm" aria-live="polite">{data ? `${projects.length} proyecto${projects.length === 1 ? "" : "s"} · Los cambios se muestran automáticamente.` : "Cargando proyectos…"}</p>
    {data && !projects.length && <div className="workspace-panel py-12 text-center"><FolderOpen className="mx-auto mb-3 opacity-40" size={36} /><h2 className="font-semibold">{query || shared ? "No hay proyectos que coincidan" : "Tu próxima carpeta comienza aquí"}</h2><p className="workspace-muted mt-2">{query || shared ? "Prueba otro filtro o busca por nombre." : "Crea un proyecto y comparte sus archivos con tu equipo."}</p></div>}
    <div className={list ? "grid gap-3" : "grid gap-4 md:grid-cols-2 xl:grid-cols-3"}>
      {projects.map(project => <article key={project.id} className="workspace-panel flex min-w-0 flex-col gap-4">
        <div className="flex items-start gap-3"><div className="rounded-xl bg-emerald-500/10 p-3 text-emerald-600 dark:text-emerald-400"><Folder size={25} /></div><div className="min-w-0 flex-1"><h2 className="break-words text-lg font-semibold">{project.name}</h2><span className="workspace-muted text-sm">{roles[project.role]}</span></div>{project.status === "archived" && <span className="workspace-badge">Archivado</span>}</div>
        <div className="flex-1"><p className="break-words text-sm">{project.description || "Carpeta de proyecto"}</p><p className="workspace-muted mt-2 break-all text-xs">{project.folderPath || "Sin carpeta vinculada"}</p>{project.canManage && <p className="workspace-muted mt-2 flex items-center gap-1 text-xs"><Users size={13} /> {new Set([project.ownerId, ...project.members.map(member => member.userId)]).size} personas con acceso</p>}{project.status === "archived" && <p className="workspace-muted mt-2 text-xs">El acceso concedido por este proyecto es de solo lectura.</p>}</div>
        <div className="flex flex-wrap items-center gap-2">{project.folderPath && <Link className="workspace-button workspace-primary" href={`/files/${folderId(project.folderPath)}`}><FolderOpen size={15} /> Abrir carpeta</Link>}{project.canManage && <>
          <button className="workspace-button" onClick={() => share(project)}><Users size={15} /> Compartir</button>
          <button className="workspace-button" aria-label={`Editar ${project.name}`} title="Editar proyecto" onClick={() => openForm(project)}><Settings2 size={15} /></button>
          {project.status === "active" && project.folderPath && <button className="workspace-button" aria-label={`Código QR de ${project.name}`} title="Compartir por QR" onClick={() => setQr({ id: folderId(project.folderPath), name: project.name })}><QrCode size={15} /></button>}
          <button className="workspace-button" disabled={busy} onClick={() => void mutate({ id: project.id, status: project.status === "active" ? "archived" : "active" }, "PATCH", project.status === "active" ? "Proyecto archivado." : "Proyecto reactivado.")}><Archive size={15} />{project.status === "active" ? "Archivar" : "Reactivar"}</button>
        </>}</div>
      </article>)}
    </div>
    {sharingProject && <section id="project-access" className="workspace-panel scroll-mt-6">
      <div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">Compartir «{sharingProject.name}»</h2><p className="workspace-muted mt-1 text-sm">Solo lectura permite consultar y descargar. Puede editar permite modificar archivos; no concede administrar usuarios ni compartir con otras personas.</p></div><button className="workspace-button" aria-label="Cerrar permisos" onClick={() => setSharing(null)} disabled={busy}><X size={17} /></button></div>
      <form className="mt-4" onSubmit={event => { event.preventDefault(); void mutate({ id: sharingProject.id, access }, "PATCH", "Permisos del proyecto guardados."); }}><fieldset disabled={busy} className="grid gap-3">
        <p className="workspace-muted text-sm">El propietario conserva el control. Desmarca una persona para retirar el acceso del proyecto. Los permisos individuales de la carpeta se administran por separado.</p>
        <div className="grid max-h-80 gap-2 overflow-y-auto">{(data?.people ?? []).filter(person => person.id !== sharingProject.ownerId).map(person => {
          const entry = access.find(item => item.userId === person.id);
          return <div key={person.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border)] p-3"><label className="flex min-w-0 flex-1 items-center gap-3"><input type="checkbox" checked={!!entry} onChange={event => setAccess(items => event.target.checked ? [...items, { userId: person.id, role: "reader" }] : items.filter(item => item.userId !== person.id))} /><span className="min-w-0 break-words text-sm">{person.name}<span className="workspace-muted block text-xs">@{person.username}</span></span></label>{entry && <select className="workspace-input" aria-label={`Permiso de ${person.name}`} value={entry.role} onChange={event => setAccess(items => items.map(item => item.userId === person.id ? { ...item, role: event.target.value as Access["role"] } : item))}><option value="reader">Solo lectura</option><option value="editor">Puede editar</option></select>}</div>;
        })}</div>
        <div><button type="submit" className="workspace-button workspace-primary">{busy ? "Guardando…" : "Guardar permisos"}</button></div>
      </fieldset></form>
    </section>}
    <ShareDialog item={qr} onClose={() => setQr(null)} />
  </div>;
}
