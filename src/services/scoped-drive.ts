import { ForbiddenError } from "../lib/errors";
import { can, canNavigate, pathFromId, permissionsFor, type Account } from "../lib/permissions";
import { localDrive, type DriveItemSummary } from "./onedrive/repo";

export function visibleItems(user: Account, items: DriveItemSummary[]) {
  return items.filter((item) => item.folder ? canNavigate(user, pathFromId(item.id)) : can(user, "read", pathFromId(item.id)))
    .map((item) => ({ ...item, permissions: permissionsFor(user, pathFromId(item.id)) }));
}

export async function listForUser(user: Account, parentId = "") {
  const parent = pathFromId(parentId);
  if (parent && !canNavigate(user, parent)) throw new ForbiddenError("No tienes acceso a esta carpeta");
  return { value: visibleItems(user, (await localDrive.listChildren(parentId)).value), permissions: permissionsFor(user, parent) };
}
