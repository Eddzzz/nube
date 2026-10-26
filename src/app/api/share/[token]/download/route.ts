import { NextRequest } from "next/server";
import { apiUser, assertPermission, workspaceStore } from "@/lib/authToken";
import { localDrive } from "@/services/onedrive/repo";
import { NotFoundError, toErrorResponse } from "@/lib/errors";
import { pathFromId } from "@/lib/permissions";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const user = await apiUser(req);
    const { token } = await params;
    const store = await workspaceStore();
    const share = await store.getShareLink(token);

    if (!share) {
      throw new NotFoundError("El enlace para compartir no existe o ha caducado");
    }

    assertPermission(user, req.nextUrl.searchParams.get("inline") === "1" ? "read" : "download", share.itemId);

    const response = await localDrive.download(share.itemId, req);
    if (req.method === "GET" && req.nextUrl.searchParams.get("inline") !== "1" && response.ok) {
      try { await store.audit(user, "Descarga iniciada desde enlace QR", pathFromId(share.itemId)); }
      catch (error) { await response.body?.cancel(); throw error; }
    }
    return response;
  } catch (error) {
    return toErrorResponse(error);
  }
}

export const HEAD = GET;
