import * as fs from "node:fs/promises";
import path from "node:path";

async function physicalPath(value: string): Promise<string> {
  let ancestor = path.resolve(value);
  const pending: string[] = [];
  for (;;) {
    try { return path.join(await fs.realpath(ancestor), ...pending); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      const parent = path.dirname(ancestor);
      if (parent === ancestor) throw error;
      pending.unshift(path.basename(ancestor)); ancestor = parent;
    }
  }
}

export async function resolvePrivateDirectory(directory: string, documentRoot?: string): Promise<string> {
  const resolved = await physicalPath(directory);
  if (documentRoot) {
    const root = await physicalPath(documentRoot);
    const relative = path.relative(root, resolved);
    if (!relative || relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative)) {
      throw new Error("LOCAL_DATA_DIR debe estar fuera de LOCAL_DRIVE_ROOT para proteger las cuentas y tokens");
    }
  }
  return resolved;
}

export function privateDataDirectory(): Promise<string> {
  return resolvePrivateDirectory(process.env.LOCAL_DATA_DIR || path.join(process.cwd(), ".local-data"), process.env.LOCAL_DRIVE_ROOT);
}
