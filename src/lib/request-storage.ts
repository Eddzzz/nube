import { headers } from "next/headers";
import { AppError } from "./errors";
import { getStorageMode } from "../services/onedrive/connection";

export const STORAGE_HEADER = "x-onedrivelist-storage";

/** Middleware replaces this header, pinning checks and streamed content to one backend. */
export async function requestStorageMode(): Promise<"local" | "onedrive"> {
  let selected: string | null = null;
  try { selected = (await headers()).get(STORAGE_HEADER); }
  catch { /* Non-request callers such as isolated tests read the persisted mode. */ }
  if (selected === "unavailable") throw new AppError("No se pudo verificar el almacenamiento del repositorio", 503);
  if (selected === "local" || selected === "onedrive") return selected;
  return getStorageMode();
}
