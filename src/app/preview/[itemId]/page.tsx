import Link from "next/link";
import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowLeft, Download, FileText, AlertCircle } from "lucide-react";
import { getItem, getDownloadUrl, localDrive } from "@/services/onedrive/repo";
import {
  getExtension,
  isAudioExtension,
  isImageExtension,
  isTextExtension,
  isMarkdownExtension,
  isPdfExtension,
  isVideoExtension,
} from "@/lib/fileTypes";
import { AudioPlayer, TextPreview, ImagePreview, PdfPreview, VideoPlayer } from "@/features/preview";
import { assertPermission, requireUser } from "@/lib/authToken";
import VersionPanel from "@/features/drive/components/VersionPanel";
import { can, pathFromId } from "@/lib/permissions";
import { ShareButton } from "@/features/share";

export const revalidate = 0;

export default async function PreviewPage({ params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params;
  const user = await requireUser();
  try {
    assertPermission(user, "read", itemId);
    const item = await getItem(itemId);
    if (item.folder) {
      return (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="workspace-panel text-center py-12">
            <h2 className="text-base font-semibold mb-2">Es una carpeta</h2>
            <p className="workspace-muted mb-4">Selecciona un archivo individual para abrir su visor.</p>
            <Link href={`/files/${itemId}`} className="workspace-button workspace-primary">
              Abrir carpeta
            </Link>
          </div>
        </div>
      );
    }

    const relative = pathFromId(itemId);
    const canDownload = can(user, "download", relative);
    const url = await getDownloadUrl(itemId);
    const ext = getExtension(item.name);
    let preview: ReactNode;

    if (isTextExtension(ext)) {
      preview = <TextPreview text={await localDrive.readText(itemId)} language={ext} />;
    } else if (isMarkdownExtension(ext)) {
      preview = (
        <div className="workspace-panel prose max-w-none break-words dark:prose-invert bg-white dark:bg-zinc-900">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{await localDrive.readText(itemId)}</ReactMarkdown>
        </div>
      );
    } else if (isPdfExtension(ext)) {
      preview = <PdfPreview src={url} name={item.name} />;
    } else if (isVideoExtension(ext)) {
      preview = <VideoPlayer src={url} name={item.name} canDownload={canDownload} />;
    } else if (isAudioExtension(ext)) {
      preview = (
        <div className="max-w-xl mx-auto">
          <AudioPlayer src={url} />
        </div>
      );
    } else if (isImageExtension(ext)) {
      preview = <ImagePreview src={url} alt={item.name} />;
    } else {
      preview = (
        <div className="workspace-panel text-center py-12">
          <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-3 text-zinc-400">
            <FileText size={24} />
          </div>
          <h2 className="text-base font-semibold mb-1 text-zinc-900 dark:text-zinc-100">
            Vista previa no disponible
          </h2>
          <p className="workspace-muted max-w-md mx-auto">
            {canDownload
              ? "Descarga este archivo para abrirlo con una aplicación compatible en tu dispositivo."
              : "Este formato no se puede reproducir en el navegador. Solicita permiso de descarga al administrador."}
          </p>
        </div>
      );
    }

    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 mb-4 transition-colors"
          >
            <ArrowLeft size={14} />
            <span>Volver a archivos</span>
          </Link>

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 break-all">
                {item.name}
              </h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 font-mono break-all">
                {relative} · {(item.size / 1024).toFixed(1)} KB
              </p>
            </div>

            <div className="flex items-center gap-2">
              <ShareButton itemId={itemId} itemName={item.name} />

              {canDownload && (
                <a
                  href={`/api/onedrive/download/${itemId}`}
                  className="workspace-button workspace-primary text-xs"
                >
                  <Download size={14} />
                  <span>Descargar archivo</span>
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="min-w-0">{preview}</div>

        <VersionPanel
          itemId={itemId}
          canManage={can(user, "versions", relative)}
          canReplace={can(user, "upload", relative)}
        />
      </div>
    );
  } catch {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="workspace-panel border-rose-500/20 bg-rose-500/5 dark:bg-rose-500/10 p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
            <AlertCircle size={24} />
          </div>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            No se pudo abrir la vista previa
          </h2>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 max-w-md mx-auto leading-relaxed">
            El archivo no existe, no tienes los permisos requeridos o su contenido no se encuentra accesible.
          </p>
          <div>
            <Link href="/" className="workspace-button workspace-primary text-xs">
              Volver al inicio
            </Link>
          </div>
        </div>
      </div>
    );
  }
}
