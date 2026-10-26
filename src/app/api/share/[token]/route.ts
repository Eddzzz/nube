import { NextRequest, NextResponse } from "next/server";
import { apiUser, assertPermission, assertSameOrigin, workspaceStore } from "@/lib/authToken";
import { localDrive } from "@/services/onedrive/repo";
import { listForUser } from "@/services/scoped-drive";
import { NotFoundError, toErrorResponse } from "@/lib/errors";
type Context = { params: Promise<{ token: string }> };
export async function GET(req: NextRequest, { params }: Context) {
  try {
    const user = await apiUser(req);
    const { token } = await params;
    const store = await workspaceStore();
    const share = await store.getShareLink(token);
    if (!share) throw new NotFoundError("El enlace no existe o ha caducado");
    assertPermission(user, "read", share.itemId);
    const item = await localDrive.getItem(share.itemId);
    const children = item.folder ? (await listForUser(user, item.id)).value : undefined;
    await store.recordShareAccess(token);
    return NextResponse.json({ share: { ...share, requiresAuth: true, accessCount: share.accessCount + 1 }, item, children,
      previewUrl: `/api/share/${token}/download?inline=1`, downloadUrl: `/api/share/${token}/download` }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return toErrorResponse(error); }
}
export async function DELETE(req: NextRequest, { params }: Context) {
  try {
    assertSameOrigin(req);
    const user = await apiUser(req);
    const { token } = await params;
    await (await workspaceStore()).deleteShareLink(user, token);
    return NextResponse.json({ ok: true });
  } catch (error) { return toErrorResponse(error); }
}
