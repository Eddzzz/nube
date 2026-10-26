import type { NextRequest } from "next/server";
import { toErrorResponse } from "@/lib/errors";
import { authorizeWrite } from "@/app/api/onedrive/utils";
import { workspaceStore } from "@/lib/authToken";
import { pathFromId } from "@/lib/permissions";
import { localDrive } from "@/services/onedrive/repo";

export const runtime = "nodejs";

export async function PUT(req: NextRequest) {
  try {
    const name = req.nextUrl.searchParams.get("filename") ?? "";
    const parentId = req.nextUrl.searchParams.get("parentId") || undefined;
    const replaceId = req.nextUrl.searchParams.get("replaceId") || undefined;
    const user = await authorizeWrite(req, "upload", replaceId || parentId);
    const item = replaceId ? await localDrive.replaceContent(replaceId, req) : await localDrive.upload(req, name, parentId);
    await (await workspaceStore()).audit(user, replaceId ? "Archivo reemplazado; versión anterior conservada" : "Archivo subido", pathFromId(item.id));
    return Response.json(item, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
