import type { NextRequest } from "next/server";
import { apiUser, assertSameOrigin, workspaceStore } from "@/lib/authToken";
import { BadRequestError, toErrorResponse } from "@/lib/errors";
import { getDrive } from "@/services/onedrive/repo";
import { createZipStream, prepareZip } from "@/services/zip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function readSelection(req: NextRequest) {
  const chunks: Uint8Array[] = [];
  const reader = req.body?.getReader();
  if (!reader) throw new BadRequestError("Selecciona archivos para descargar");
  let bytes = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 200000) throw new BadRequestError("La selección de descarga es demasiado grande");
      chunks.push(chunk.value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const actor = await apiUser(req);
    const localDrive = await getDrive();
    const body = await readSelection(req);
    const entries = await prepareZip(localDrive, actor, body?.ids);
    const files = entries.filter((entry) => !entry.folder);
    const names = files.map((entry) => entry.path).join(", ");
    await (await workspaceStore()).audit(actor, "Descarga ZIP iniciada", `${files.length} archivos: ${names.length > 4000 ? names.slice(0, 4000) + "…" : names}`);
    return new Response(createZipStream(localDrive, entries, req), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="archivos-repositorio.zip"',
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) { return toErrorResponse(error); }
}
