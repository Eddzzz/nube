import { createHmac } from "node:crypto";
import { appConfig } from "@/lib/config";
import { createLocalDrive } from "../local-drive";
import { createOneDriveDrive } from "./graph-drive";
import { getOneDriveConnection, getOneDriveAccessToken } from "./connection";
import { createStorageRouter } from "../storage-router";
import { privateDataDirectory } from "../../lib/private-data";
import { requestStorageMode } from "../../lib/request-storage";

export type DriveItemSummary = {
  id: string;
  name: string;
  folder?: Record<string, unknown>;
  file?: { mimeType?: string };
  size: number;
  lastModifiedDateTime: string;
};

export const diskDrive = createLocalDrive(appConfig.LOCAL_DRIVE_ROOT);
export const oneDrive = createOneDriveDrive({ getConnection: getOneDriveConnection, getAccessToken: getOneDriveAccessToken, dataDirectory: privateDataDirectory });
export const drive = createStorageRouter(diskDrive, oneDrive, requestStorageMode);
export async function getDrive() { return await requestStorageMode() === "onedrive" ? oneDrive : diskDrive; }
// Keep the existing import contract; every operation now uses the selected backend.
export const localDrive = drive;
export const { listChildren, getItem, searchItems, createFolder, renameDriveItem, deleteDriveItem } = localDrive;

export async function getDownloadUrl(itemId: string): Promise<string> {
  await localDrive.getItem(itemId);
  const query = new URLSearchParams({ inline: "1" });
  if (appConfig.DOWNLOAD_TOKEN_SECRET) {
    const expires = String(Math.floor(Date.now() / 1000) + 3600);
    query.set("exp", expires);
    query.set("sig", createHmac("sha256", appConfig.DOWNLOAD_TOKEN_SECRET).update(itemId + ":" + expires).digest("base64url"));
  }
  return "/api/onedrive/download/" + itemId + "?" + query;
}

export function isOriginAllowed(origin: string, selfOrigin: string): boolean {
  try {
    const originUrl = new URL(origin);
    return originUrl.origin === selfOrigin || appConfig.downloadAllowedOrigins.includes(originUrl.origin);
  } catch {
    return false;
  }
}
