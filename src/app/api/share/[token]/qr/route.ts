import { NextRequest, NextResponse } from "next/server";
import { apiUser, assertPermission, workspaceStore } from "@/lib/authToken";
import { getShareOrigin } from "@/lib/shareOrigin";
import { generateQrSvg } from "@/features/share/lib/qr";
import { NotFoundError, toErrorResponse } from "@/lib/errors";

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
      throw new NotFoundError("El enlace no existe o ha caducado");
    }

    assertPermission(user, "read", share.itemId);
    const origin = getShareOrigin(req);
    const shareUrl = `${origin}/share/${token}`;

    const svg = generateQrSvg(shareUrl, { size: 300, margin: 4 });

    return new NextResponse(svg, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "private, no-store",
        "Content-Disposition": "attachment; filename=\"codigo-qr.svg\"",
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
