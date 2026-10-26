import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { workspaceStore, currentUser, assertPermission } from "@/lib/authToken";
import { can, pathFromId } from "@/lib/permissions";
import { localDrive } from "@/services/onedrive/repo";
import { listForUser } from "@/services/scoped-drive";
import { getExtension, isAudioExtension, isImageExtension, isTextExtension, isMarkdownExtension, isPdfExtension, isVideoExtension } from "@/lib/fileTypes";
import { AudioPlayer, TextPreview, ImagePreview, PdfPreview, VideoPlayer } from "@/features/preview";
export const revalidate = 0;
function Notice({ children }: { children: ReactNode }) {
  return <main className="mx-auto max-w-lg px-4 py-20"><div className="workspace-panel space-y-4 p-6"><h1 className="text-xl font-semibold">Acceso al contenido compartido</h1><p className="text-sm text-zinc-500">{children}</p><Link href="/" className="inline-block text-sm underline">Volver al repositorio</Link></div></main>;
}
export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const user = await currentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/share/${token}`)}`);
  const store = await workspaceStore();
  const share = await store.getShareLink(token);
  if (!share) return <Notice>El enlace ha caducado, fue revocado o ya no está disponible.</Notice>;
  try { assertPermission(user, "read", share.itemId); }
  catch { return <Notice>Tu cuenta no tiene acceso a esta carpeta o proyecto. Solicita al responsable que te agregue como integrante.</Notice>; }
  let item;
  try { item = await localDrive.getItem(share.itemId); }
  catch { return <Notice>El archivo o carpeta se movió o ya no existe.</Notice>; }
  await store.recordShareAccess(token);
  const download = can(user, "download", pathFromId(item.id));
  const downloadUrl = `/api/share/${token}/download`;
  const inlineUrl = `${downloadUrl}?inline=1`;
  const ext = getExtension(item.name);
  let preview: ReactNode;
  if (item.folder) {
    const { value } = await listForUser(user, item.id);
    preview = <div className="workspace-panel divide-y divide-zinc-200 dark:divide-zinc-800">{value.length ? value.map(child => <Link key={child.id} href={child.folder ? `/files/${child.id}` : `/preview/${child.id}`} className="flex items-center justify-between gap-4 p-4 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"><span className="break-all">{child.name}</span><span className="shrink-0 text-xs text-zinc-500">{child.folder ? "Carpeta →" : "Abrir →"}</span></Link>) : <p className="p-6 text-sm text-zinc-500">No hay archivos disponibles en esta carpeta.</p>}</div>;
  } else if (isTextExtension(ext) || isMarkdownExtension(ext)) {
    preview = <TextPreview text={await localDrive.readText(item.id)} language={ext}/>;
  } else if (isPdfExtension(ext)) preview = <PdfPreview src={inlineUrl} name={item.name}/>;
  else if (isVideoExtension(ext)) preview = <VideoPlayer src={inlineUrl} name={item.name} canDownload={download}/>;
  else if (isAudioExtension(ext)) preview = <AudioPlayer src={inlineUrl}/>;
  else if (isImageExtension(ext)) preview = <ImagePreview src={inlineUrl} alt={item.name}/>;
  else preview = <div className="workspace-panel p-10 text-center text-sm text-zinc-500">Este formato no tiene vista previa. {download && <a className="underline" href={downloadUrl}>Descargar archivo</a>}</div>;
  return <main className="mx-auto max-w-6xl space-y-6 px-4 py-8"><header className="workspace-panel flex flex-wrap items-center justify-between gap-4 p-5"><div className="min-w-0"><p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Personas con acceso · {item.folder ? "Carpeta compartida" : "Archivo compartido"}</p><h1 className="mt-1 break-all text-xl font-semibold">{item.name}</h1><p className="mt-2 text-xs text-zinc-500">Compartido por {share.createdBy}{share.expiresAt && ` · Vence ${new Date(share.expiresAt).toLocaleDateString("es")}`}</p></div><div className="flex gap-3 text-sm"><Link href="/" className="rounded-xl border border-zinc-200 px-4 py-2 dark:border-zinc-700">Repositorio</Link>{!item.folder && download && <a href={downloadUrl} className="rounded-xl bg-emerald-600 px-4 py-2 text-white">Descargar</a>}</div></header>{preview}</main>;
}
