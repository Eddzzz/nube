"use client";
import { useEffect, useRef, useState } from "react";
import { X, QrCode, Copy, Check, Loader2, Lock, Download } from "lucide-react";
import QRCode from "./QRCode";
export type ShareItem = { id: string; name: string };
export default function ShareDialog({ item, onClose }: { item: ShareItem | null; onClose: () => void }) {
  const [duration, setDuration] = useState("7d");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [data, setData] = useState<{ url: string; id: string; expiresAt: string } | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const linkRef = useRef<HTMLInputElement>(null);
  useEffect(() => { setData(null); setError(""); setDuration("7d"); closeRef.current?.focus(); }, [item]);
  useEffect(() => {
    if (!item) return;
    const escape = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [item, onClose]);
  if (!item) return null;
  async function generate() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/share", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId: item!.id, duration }) });
      if (!response.ok) throw new Error(await response.text());
      const result = await response.json();
      setData({ url: result.url, id: result.share.id, expiresAt: result.share.expiresAt });
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo crear el enlace"); }
    finally { setBusy(false); }
  }
  async function copy() {
    if (!data) return;
    try {
      if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(data.url);
      else {
        linkRef.current?.focus(); linkRef.current?.select();
        if (!document.execCommand("copy")) throw new Error();
      }
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    } catch { setError("Selecciona el enlace y cópialo manualmente."); linkRef.current?.select(); }
  }
  async function revoke() {
    if (!data) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/share/${data.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error(await response.text());
      setData(null);
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo revocar el enlace"); }
    finally { setBusy(false); }
  }
  const button = "inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-200 px-4 py-2 text-sm dark:border-zinc-700 disabled:opacity-50";
  return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
    <section role="dialog" aria-modal="true" aria-labelledby="share-title" onClick={e => e.stopPropagation()} className="w-full max-w-lg max-h-[92vh] overflow-auto rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900" onKeyDown={e => {
      if (e.key !== "Tab") return;
      const nodes = e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input, select');
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    }}>
      <div className="flex items-start justify-between gap-3"><div><h2 id="share-title" className="flex items-center gap-2 text-lg font-semibold"><QrCode size={20}/> Compartir por QR</h2><p className="mt-1 break-all text-sm text-zinc-500">{item.name}</p></div><button ref={closeRef} onClick={onClose} aria-label="Cerrar" className="rounded-lg p-2"><X size={18}/></button></div>
      <div className="my-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-100"><p className="flex items-center gap-2 font-medium"><Lock size={16}/> Personas con acceso</p><p className="mt-2">El destinatario debe iniciar sesión y tener permiso en esta carpeta o proyecto. El QR conserva los permisos existentes.</p><a href="/project" className="mt-2 inline-block underline underline-offset-4">Gestionar acceso del proyecto</a></div>
      {error && <p role="alert" className="mb-4 text-sm text-rose-600 dark:text-rose-400">{error}</p>}
      {!data ? <div className="space-y-4"><label className="block text-sm font-medium" htmlFor="share-duration">Vigencia del enlace</label><select id="share-duration" value={duration} onChange={e => setDuration(e.target.value)} className="w-full rounded-xl border border-zinc-300 bg-transparent p-3 dark:border-zinc-700"><option value="24h">24 horas</option><option value="7d">7 días</option><option value="30d">30 días</option><option value="never">Hasta que se revoque</option></select><button disabled={busy} onClick={generate} className={`${button} w-full bg-emerald-600 text-white`}>{busy && <Loader2 className="animate-spin" size={16}/>} Generar código QR</button></div> : <div className="space-y-4">
        <QRCode value={data.url} size={240} showActions={false}/>
        <p className="text-center text-xs text-zinc-500">Conecta el celular a la misma red del servidor. {data.expiresAt ? `Vence: ${new Date(data.expiresAt).toLocaleString("es")}` : "Vigente hasta su revocación."}</p>
        <label htmlFor="share-link" className="block text-sm font-medium">Enlace de acceso</label><input ref={linkRef} id="share-link" readOnly value={data.url} onFocus={e => e.target.select()} className="w-full min-w-0 rounded-xl border border-zinc-300 bg-transparent p-3 text-xs dark:border-zinc-700"/>
        <div className="flex flex-wrap gap-2"><button onClick={copy} className={button}>{copied ? <Check size={15}/> : <Copy size={15}/>} {copied ? "Copiado" : "Copiar enlace"}</button><a href={`/api/share/${data.id}/qr`} download="codigo-qr.svg" className={button}><Download size={15}/> Descargar QR</a><a href={data.url} target="_blank" rel="noopener noreferrer" className={button}>Abrir</a></div>
        <button disabled={busy} onClick={revoke} className={`${button} w-full text-rose-600`}>Revocar enlace</button>
      </div>}
    </section>
  </div>;
}
