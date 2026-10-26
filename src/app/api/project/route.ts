import type { NextRequest } from "next/server";
import { apiUser, assertSameOrigin, workspaceStore } from "@/lib/authToken";
import { assertAdmin } from "@/app/api/onedrive/utils";
import { BadRequestError, toErrorResponse } from "@/lib/errors";
import { canContribute } from "@/lib/permissions";
import { localDrive } from "@/services/onedrive/repo";

export async function GET(req: NextRequest) {
  try {
    const actor = await apiUser(req);
    const project = await (await workspaceStore()).getProject(actor);
    return Response.json({ ...project, canEdit: canContribute(actor), usage: actor.role === "admin" ? await localDrive.usage() : null });
  } catch (error) { return toErrorResponse(error); }
}

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const actor = await apiUser(req);
    const body = await req.json();
    if (body?.kind === "structure") {
      await assertAdmin(req);
      async function ensure(name: string, parentId?: string) {
        const existing = (await localDrive.listChildren(parentId)).value.find((i) => i.name.toLowerCase() === name.toLowerCase());
        if (existing) {
          if (!existing.folder) throw new BadRequestError(`Ya existe un archivo llamado ${name}`);
          return existing;
        }
        return localDrive.createFolder({ name, parentId, conflictBehavior: "fail" });
      }
      const root = await ensure("Proyecto_OneDrive_2026");
      for (const folder of ["01_Planificacion", "02_Fuentes", "03_Trabajo_colaborativo", "04_Evidencias", "05_Entrega_final"]) await ensure(folder, root.id);
      await (await workspaceStore()).audit(actor, "Estructura académica creada", "Proyecto_OneDrive_2026");
      return Response.json({ id: root.id });
    }
    return Response.json(await (await workspaceStore()).updateProject(actor, body));
  } catch (error) { return toErrorResponse(error); }
}
