import Link from "next/link";
import { requireUser, assertPermission } from "@/lib/authToken";
import { can, pathFromId } from "@/lib/permissions";
import { localDrive } from "@/services/onedrive/repo";
import VersionPanel from "@/features/drive/components/VersionPanel";

export default async function VersionsPage({ params }: { params: Promise<{ itemId: string }> }) {
  const user = await requireUser();
  const { itemId } = await params;
  try {
    assertPermission(user, "read", itemId);
    const item = await localDrive.getItem(itemId);
    if (item.folder) return <div className="workspace-page">Selecciona un archivo para consultar sus versiones.</div>;
    const relative = pathFromId(itemId);
    return <div className="workspace-page max-w-4xl"><Link href="/" className="workspace-link">Volver a archivos</Link><div className="workspace-heading mt-5"><div><h1 className="break-all">{item.name}</h1><p className="break-all">{relative} · {(item.size / 1024).toFixed(1)} KB</p></div>
      {can(user, "download", relative) && <a className="workspace-button" href={`/api/onedrive/download/${itemId}`}>Descargar archivo actual</a>}
    </div><VersionPanel itemId={itemId} canManage={can(user, "versions", relative)} canReplace={can(user, "upload", relative)} /></div>;
  } catch { return <div className="workspace-page"><p role="alert" className="workspace-error">El archivo no existe o no tienes permiso para consultarlo.</p><Link href="/" className="workspace-link">Volver a archivos</Link></div>; }
}
