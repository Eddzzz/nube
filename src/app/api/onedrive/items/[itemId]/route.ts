import type { NextRequest } from "next/server";

import { deleteDriveItem, renameDriveItem } from "@/services/onedrive/repo";
import { BadRequestError, toErrorResponse } from "@/lib/errors";
import { authorizeWrite, protectFolderGrants } from "@/app/api/onedrive/utils";
import { workspaceStore } from "@/lib/authToken";
import { pathFromId } from "@/lib/permissions";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const { itemId } = await params;
    const user = await authorizeWrite(req, "delete", itemId);
    await protectFolderGrants(user, itemId);
    await deleteDriveItem(itemId);
    await (await workspaceStore()).audit(user, "Elemento enviado a la papelera", pathFromId(itemId));
    return new Response(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const { itemId } = await params;
    const user = await authorizeWrite(req, "rename", itemId);
    await protectFolderGrants(user, itemId);
    const body = (await req.json().catch(() => null)) as { name?: unknown } | null;
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name) {
      throw new BadRequestError("El nombre es obligatorio");
    }

    const updated = await renameDriveItem(itemId, name);
    await (await workspaceStore()).audit(user, "Elemento renombrado", pathFromId(itemId) + " → " + pathFromId(updated.id));
    return Response.json(updated);
  } catch (error) {
    return toErrorResponse(error);
  }
}
