import * as fs from "node:fs/promises";
import path from "node:path";
import { hostname } from "node:os";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { AppError, ForbiddenError } from "../lib/errors";

async function removeOwner(directory: string, owner: string) {
  try { await fs.unlink(path.join(directory, owner)); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  try { await fs.rmdir(directory); }
  catch (error) {
    // A contender may already have published its own nonempty directory.
    if (!["ENOENT", "ENOTEMPTY", "EEXIST"].includes((error as NodeJS.ErrnoException).code || "")) throw error;
  }
}

async function recoverDeadOwner(directory: string) {
  try {
    const info = await fs.lstat(directory);
    if (info.isSymbolicLink() || !info.isDirectory()) throw new ForbiddenError("Bloqueo de almacenamiento no válido");
    const entries = await fs.readdir(directory);
    if (entries.length !== 1 || !/^owner-\d+-[a-f0-9-]{36}\.json$/.test(entries[0])) return;
    const filename = path.join(directory, entries[0]);
    if (!(await fs.lstat(filename)).isFile()) throw new ForbiddenError("Propietario del bloqueo no válido");
    const owner = JSON.parse(await fs.readFile(filename, "utf8")) as { pid?: number; host?: string };
    if (owner.host !== hostname() || !Number.isSafeInteger(owner.pid) || owner.pid! <= 0) return;
    try { process.kill(owner.pid!, 0); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ESRCH") await removeOwner(directory, entries[0]);
      // EPERM and foreign/reused PIDs cannot prove that the owner has stopped.
    }
  } catch (error) {
    // Windows can deny reads while another worker removes/replaces this directory.
    // Retry acquisition within its deadline; an unreadable owner is never reclaimed.
    if (!["ENOENT", "EPERM", "EACCES"].includes((error as NodeJS.ErrnoException).code || "")) throw error;
  }
}

/** A directory lock also serializes separate Next.js workers sharing this disk. */
export async function withDirectoryLock<T>(directory: string, operation: () => Promise<T>, timeoutMs = 10000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  const token = randomUUID();
  const prepared = `${directory}.${process.pid}.${token}`;
  const owner = `owner-${process.pid}-${token}.json`;
  await fs.mkdir(prepared);
  try {
    await fs.writeFile(path.join(prepared, owner), JSON.stringify({ pid: process.pid, host: hostname() }), { flag: "wx", mode: 0o600 });
    for (;;) {
      try {
        // Publish owner and lock together; an active lock is never an empty directory.
        await fs.rename(prepared, directory);
        break;
      } catch (error) {
        if (!["EEXIST", "ENOTEMPTY", "EPERM", "EACCES"].includes((error as NodeJS.ErrnoException).code || "")) throw error;
        await recoverDeadOwner(directory);
        if (Date.now() >= deadline) throw new AppError("Hay otra operación de escritura en curso. Vuelve a intentarlo. Si persiste tras reiniciar, revisa el bloqueo con el servidor detenido.", 503);
        await delay(25);
      }
    }
    try { return await operation(); }
    finally { await removeOwner(directory, owner); }
  } finally {
    await removeOwner(prepared, owner);
  }
}
