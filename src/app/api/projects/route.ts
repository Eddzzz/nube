import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiUser, assertSameOrigin, workspaceStore } from "@/lib/authToken";
import { BadRequestError, toErrorResponse } from "@/lib/errors";
import { pathFromId } from "@/lib/permissions";
import { localDrive } from "@/services/onedrive/repo";

export async function GET(req: NextRequest) {
  try {
    const actor = await apiUser(req); const store = await workspaceStore();
    const [projects, people] = await Promise.all([store.listFolderProjects(actor), store.folderProjectPeople(actor)]);
    return Response.json({ projects, people });
  } catch (error) { return toErrorResponse(error); }
}
export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req); const actor = await apiUser(req);
    const parsed = z.object({ name: z.string().trim().min(1).max(200), description: z.string().trim().max(4000).default(""), template: z.boolean().default(true) }).strict().safeParse(await req.json());
    if (!parsed.success) throw new BadRequestError(parsed.error.issues.map(issue => issue.message).join(". "));
    const value = parsed.data;
    let base = (await localDrive.listChildren()).value.find(item => item.name.toLowerCase() === "proyectos");
    if (!base) {
      try { base = await localDrive.createFolder({ name: "Proyectos", conflictBehavior: "fail" }); }
      catch (error) {
        base = (await localDrive.listChildren()).value.find(item => item.name.toLowerCase() === "proyectos");
        if (!base) throw error;
      }
    }
    if (!base.folder) throw new BadRequestError("Proyectos debe ser una carpeta");
    const folder = await localDrive.createFolder({ name: value.name, parentId: base.id, conflictBehavior: "rename" });
    try {
      if (value.template) for (const name of ["01_Planificacion", "02_Fuentes", "03_Trabajo_colaborativo", "04_Evidencias", "05_Entrega_final"]) await localDrive.createFolder({ name, parentId: folder.id, conflictBehavior: "fail" });
      const project = await (await workspaceStore()).createFolderProject(actor, { name: folder.name, description: value.description, folderPath: pathFromId(folder.id) });
      return Response.json({ project }, { status: 201 });
    } catch (error) {
      await localDrive.deleteDriveItem(folder.id).catch(() => undefined);
      throw error;
    }
  } catch (error) { return toErrorResponse(error); }
}
export async function PATCH(req: NextRequest) {
  try {
    assertSameOrigin(req); const actor = await apiUser(req);
    const project = await (await workspaceStore()).updateFolderProject(actor, await req.json());
    return Response.json({ project });
  } catch (error) { return toErrorResponse(error); }
}
