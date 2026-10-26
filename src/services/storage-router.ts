import type { createLocalDrive } from "./local-drive";

export type DriveBackend = ReturnType<typeof createLocalDrive>;

/** Resolve mode on every operation so every worker observes connect/disconnect. */
export function createStorageRouter(local: DriveBackend, cloud: DriveBackend, getMode: () => Promise<"local" | "onedrive">): DriveBackend {
  async function call<K extends keyof DriveBackend>(key: K, args: Parameters<DriveBackend[K]>): Promise<Awaited<ReturnType<DriveBackend[K]>>> {
    const selected = await getMode() === "onedrive" ? cloud : local;
    const method = selected[key] as (...parameters: Parameters<DriveBackend[K]>) => ReturnType<DriveBackend[K]>;
    return await method(...args);
  }
  return {
    getItem: (...args) => call("getItem", args),
    listChildren: (...args) => call("listChildren", args),
    searchItems: (...args) => call("searchItems", args),
    createFolder: (...args) => call("createFolder", args),
    renameDriveItem: (...args) => call("renameDriveItem", args),
    deleteDriveItem: (...args) => call("deleteDriveItem", args),
    upload: (...args) => call("upload", args),
    replaceContent: (...args) => call("replaceContent", args),
    readText: (...args) => call("readText", args),
    download: (...args) => call("download", args),
    usage: (...args) => call("usage", args),
    listTrash: (...args) => call("listTrash", args),
    restoreTrash: (...args) => call("restoreTrash", args),
    listVersions: (...args) => call("listVersions", args),
    saveVersion: (...args) => call("saveVersion", args),
    restoreVersion: (...args) => call("restoreVersion", args),
  };
}
