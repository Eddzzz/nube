import type { NextRequest } from "next/server";
import { apiUser, assertPermission, assertSameOrigin, workspaceStore } from "@/lib/authToken";
import { ForbiddenError } from "@/lib/errors";
import { hasGrantsWithin, pathFromId, type Permission, type Account } from "@/lib/permissions";
import { localDrive } from "@/services/onedrive/repo";

export async function assertAdmin(req: NextRequest): Promise<Account> {
  const user = await apiUser(req);
  if (user.role !== "admin") throw new ForbiddenError("Se requieren permisos de administrador");
  if (!["GET", "HEAD"].includes(req.method)) assertSameOrigin(req);
  return user;
}

export async function authorizeWrite(req: NextRequest, permission: Permission, itemId = "") {
  assertSameOrigin(req);
  const user = await apiUser(req);
  assertPermission(user, permission, itemId);
  return user;
}

export async function protectFolderGrants(_user: Account, itemId: string) {
  const item = await localDrive.getItem(itemId);
  if (!item.folder) return;
  const users = await (await workspaceStore()).grantHolders();
  if (hasGrantsWithin(users, pathFromId(itemId))) throw new ForbiddenError("Esta carpeta contiene permisos asignados. Pide al administrador que los retire antes de renombrarla o eliminarla.");
}
