import type { NextRequest } from "next/server";
import { z } from "zod";
import { assertAdmin, authorizeWrite } from "@/app/api/onedrive/utils";
import { apiUser, assertPermission, workspaceStore } from "@/lib/authToken";
import { BadRequestError, toErrorResponse } from "@/lib/errors";
import { pathFromId } from "@/lib/permissions";
import { localDrive } from "@/services/onedrive/repo";

export async function GET(req: NextRequest) {
  try {
    const itemId = req.nextUrl.searchParams.get("itemId");
    if (itemId) {
      assertPermission(await apiUser(req), "versions", itemId);
      return Response.json({ versions: await localDrive.listVersions(itemId) });
    }
    await assertAdmin(req);
    return Response.json({ trash: await localDrive.listTrash() });
  } catch (error) { return toErrorResponse(error); }
}

const schema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("snapshot"), itemId: z.string().min(1) }),
  z.object({ kind: z.literal("restoreVersion"), itemId: z.string().min(1), versionId: z.string().min(1) }),
  z.object({ kind: z.literal("restoreTrash"), id: z.string().min(1) }),
]);

export async function POST(req: NextRequest) {
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) throw new BadRequestError("Datos de recuperación no válidos");
    const body = parsed.data;
    if (body.kind === "restoreTrash") {
      const actor = await assertAdmin(req);
      const item = await localDrive.restoreTrash(body.id);
      await (await workspaceStore()).audit(actor, "Elemento recuperado de la papelera", pathFromId(item.id));
      return Response.json(item);
    }
    const actor = await authorizeWrite(req, "versions", body.itemId);
    const result = body.kind === "snapshot" ? await localDrive.saveVersion(body.itemId) : await localDrive.restoreVersion(body.itemId, body.versionId);
    await (await workspaceStore()).audit(actor, body.kind === "snapshot" ? "Versión guardada" : "Versión restaurada", pathFromId(body.itemId));
    return Response.json(result);
  } catch (error) { return toErrorResponse(error); }
}
