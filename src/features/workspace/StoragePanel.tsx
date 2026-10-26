"use client";

import { useCallback, useEffect, useState } from "react";
import { Cloud, HardDrive } from "lucide-react";
import { requestJson } from "./client";

interface StorageStatus {
  configured: boolean;
  connected: boolean;
  active: boolean;
  accountName?: string;
  accountId?: string;
  rootName: string;
  missing: string[];
  redirectUri: string | null;
}

export default function StoragePanel() {
  const [status, setStatus] = useState<StorageStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const [pageOrigin, setPageOrigin] = useState("");

  const load = useCallback(async () => {
    try {
      setStatus(await requestJson<StorageStatus>("/api/admin/onedrive"));
      setLoadError("");
    } catch {
      setLoadError("No se pudo consultar el almacenamiento. Comprueba la conexión y tu sesión; se volverá a intentar automáticamente.");
    }
  }, []);

  useEffect(() => {
    setPageOrigin(window.location.origin);
    const query = new URLSearchParams(window.location.search);
    if (query.has("error")) setNotice("No se completó la autorización de Microsoft. Revisa la configuración e intenta conectar de nuevo.");
    else if (query.get("connected") === "1") setNotice("Autorización completada. Consulta el estado de la conexión a continuación.");
  }, []);

  useEffect(() => {
    if (busy) return;
    const refresh = () => { if (!document.hidden) void load(); };
    refresh();
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [load, busy]);

  async function connect() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const { url } = await requestJson<{ url: string }>("/api/admin/onedrive/connect", "POST");
      const destination = new URL(url);
      if (destination.protocol !== "https:" || destination.hostname !== "login.microsoftonline.com") throw new Error("Invalid destination");
      window.location.assign(destination.href);
    } catch {
      setError("No se pudo iniciar la conexión con Microsoft. Revisa la configuración y vuelve a intentarlo.");
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/onedrive", { method: "DELETE" });
      if (!response.ok) throw new Error("Disconnect failed");
      setStatus((current) => current ? { ...current, active: true, connected: false } : current);
      setConfirmDisconnect(false);
      setNotice("Cuenta desconectada. Los archivos permanecen en OneDrive. Reconecta para que el equipo vuelva a acceder a ellos.");
    } catch {
      setError("No se pudo desconectar la cuenta. Comprueba tu conexión y vuelve a intentarlo.");
    } finally {
      setBusy(false);
    }
  }

  const label = status?.connected ? "OneDrive conectado" : status?.active ? "OneDrive necesita reconectar" : "Local";
  const authorizationOrigin = status?.redirectUri ? new URL(status.redirectUri).origin : "";
  const differentOrigin = !!pageOrigin && !!authorizationOrigin && pageOrigin !== authorizationOrigin;

  return (
    <div className="workspace-page max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-7 space-y-7 text-zinc-900 dark:text-zinc-100">
      <header className="pb-4 border-b border-zinc-200 dark:border-zinc-800">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Almacenamiento</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Conecta una cuenta Microsoft propietaria para guardar los archivos de todo el equipo en OneDrive.</p>
      </header>

      {error && <p role="alert" className="workspace-error p-4 rounded-xl text-sm">{error}</p>}
      {loadError && <p role="alert" className="workspace-error p-4 rounded-xl text-sm">{loadError}</p>}
      {notice && <p role="status" className="workspace-notice p-4 rounded-xl text-sm">{notice}</p>}
      {!status && !loadError && <p role="status" className="text-sm text-zinc-600 dark:text-zinc-400">Consultando almacenamiento…</p>}

      {status && (
        <section aria-labelledby="storage-status" className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 sm:p-6 space-y-5">
          <div className="flex items-start gap-3">
            {status.active || status.connected ? <Cloud size={24} aria-hidden="true" className="shrink-0 mt-0.5" /> : <HardDrive size={24} aria-hidden="true" className="shrink-0 mt-0.5" />}
            <div className="min-w-0">
              <h2 id="storage-status" className="text-lg font-semibold">{label}</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{status.connected ? "Los documentos se guardan en la cuenta propietaria. Los permisos se gestionan en esta aplicación." : status.active ? "El acceso a los archivos está detenido hasta reconectar. El disco local no se activa como alternativa." : "Se utiliza la carpeta local configurada hasta la primera conexión con OneDrive."}</p>
            </div>
          </div>
          <dl className="space-y-3 text-sm">
            {(status.accountName || status.accountId) && <div><dt className="text-zinc-600 dark:text-zinc-400">Cuenta propietaria</dt><dd className="font-medium break-all">{status.accountName || status.accountId}</dd></div>}
            <div><dt className="text-zinc-600 dark:text-zinc-400">Carpeta dedicada en OneDrive</dt><dd className="font-medium break-all">{status.rootName}</dd></div>
          </dl>
          {!status.configured && <div className="text-sm space-y-2"><p>Completa estas variables en el servidor y reinícialo para conectar:</p><ul className="list-disc pl-5 space-y-1">{status.missing.map((name) => <li key={name} className="font-mono break-all">{name}</li>)}</ul></div>}
          <div className="flex flex-wrap gap-3">
            <button type="button" className="workspace-button workspace-primary px-4 py-2 text-sm disabled:opacity-50" disabled={!status.configured || busy || differentOrigin} onClick={() => void connect()}>{busy ? "Procesando…" : status.connected || status.active ? "Reconectar cuenta Microsoft" : "Conectar cuenta Microsoft"}</button>
            {status.connected && !confirmDisconnect && <button type="button" disabled={busy} className="workspace-button px-4 py-2 text-sm" onClick={() => setConfirmDisconnect(true)}>Desconectar</button>}
          </div>
          {differentOrigin && <p className="text-sm">Para autorizar Microsoft, <a className="workspace-link underline" href={`${authorizationOrigin}/admin/storage`}>abre este panel en {authorizationOrigin}</a> e inicia sesión allí. Después, el equipo puede seguir usando la dirección de la red local.</p>}
          {confirmDisconnect && <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4 space-y-3"><p className="text-sm">¿Desconectar la cuenta de todo el equipo? Los archivos no se eliminan, pero nadie podrá acceder a ellos desde la aplicación hasta reconectar. No se volverá al disco local.</p><div className="flex flex-wrap gap-3"><button type="button" disabled={busy} className="workspace-button px-4 py-2 text-sm" onClick={() => void disconnect()}>Confirmar desconexión</button><button type="button" disabled={busy} className="workspace-button px-4 py-2 text-sm" onClick={() => setConfirmDisconnect(false)}>Cancelar</button></div></div>}
        </section>
      )}

      <section aria-labelledby="storage-setup" className="space-y-4 text-sm">
        <h2 id="storage-setup" className="text-lg font-semibold">Preparar la conexión</h2>
        <ol className="list-decimal pl-5 space-y-3 text-zinc-700 dark:text-zinc-300">
          <li>Registra una aplicación en Microsoft Entra que permita cuentas Microsoft personales. Añade la plataforma <strong>Web</strong>.</li>
          <li>Registra exactamente la URI de redirección configurada en el servidor: <code className="block mt-2 break-all text-xs">{status?.redirectUri || "http://localhost:3000/api/admin/onedrive/callback"}</code><p className="mt-2">Para desarrollo, Microsoft permite HTTP en localhost. Una IP de la red local con HTTP no sirve para esta autorización: abre el panel en localhost e inicia sesión allí. En producción utiliza HTTPS.</p></li>
          <li>Añade los permisos delegados <code>User.Read</code>, <code>Files.ReadWrite</code> y <code>offline_access</code>.</li>
          <li>Configura <code className="break-all">ONEDRIVE_CLIENT_ID</code>, <code className="break-all">ONEDRIVE_CLIENT_SECRET</code> y <code className="break-all">ONEDRIVE_REDIRECT_URI</code> en el servidor. Usa el <strong>valor</strong> del secreto, no su identificador. Nunca lo compartas ni lo introduzcas en el navegador.</li>
          <li>Opcionalmente configura <code className="break-all">ONEDRIVE_TENANT</code> (por defecto <code>consumers</code>) y <code className="break-all">ONEDRIVE_ROOT_FOLDER</code> (por defecto <code>OneDriveList</code>). Reinicia el servidor y conecta la cuenta propietaria desde este panel.</li>
        </ol>
      </section>
      <section aria-labelledby="storage-scope" className="border-t border-zinc-200 dark:border-zinc-800 pt-5 text-sm text-zinc-600 dark:text-zinc-400 space-y-3">
        <h2 id="storage-scope" className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Qué cambia para el equipo</h2>
        <p>Todos los archivos se guardan en la carpeta dedicada de una sola cuenta OneDrive. Los archivos locales existentes no se suben automáticamente.</p>
        <p>Usuarios, permisos, sesiones e historial de actividad permanecen en el almacén privado de esta PC. Cada persona conserva su acceso habitual a la aplicación y nunca recibe los tokens Microsoft. Los QR siguen requiriendo inicio de sesión y permisos.</p>
        <p>La PC y el servidor deben permanecer encendidos. La conexión no añade coedición de Word o Excel web.</p>
        <p className="text-xs">El estado se consulta automáticamente cada 30 segundos y al regresar a la ventana.</p>
      </section>
    </div>
  );
}
