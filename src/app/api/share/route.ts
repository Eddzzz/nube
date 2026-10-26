import { NextRequest, NextResponse } from "next/server";
import { apiUser, assertPermission, assertSameOrigin, workspaceStore } from "@/lib/authToken";
import { localDrive } from "@/services/onedrive/repo";
import { BadRequestError, toErrorResponse } from "@/lib/errors";
import { getShareOrigin, shareExpiry } from "@/lib/shareOrigin";
export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const user = await apiUser(req);
    const body = await req.json();
    if (!body || typeof body.itemId !== "string" || !body.itemId) throw new BadRequestError("Selecciona un archivo o carpeta");
    assertPermission(user, "share", body.itemId);
    const expiresAt = shareExpiry(body.duration);
    const origin = getShareOrigin(req);
    const item = await localDrive.getItem(body.itemId);
    const share = await (await workspaceStore()).createShareLink(user, { itemId: item.id, itemName: item.name, expiresAt, requiresAuth: true });
    return NextResponse.json({ share, url: `${origin}/share/${share.id}` }, { status: 201 });
  } catch (error) { return toErrorResponse(error); }
}
