import * as fs from "node:fs/promises";
import path from "node:path";
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import { privateDataDirectory } from "../../lib/private-data";
import { AppError } from "../../lib/errors";
import { withDirectoryLock } from "../file-lock";

type Config = { directory: string | (() => Promise<string>); clientId?: string; clientSecret?: string; redirectUri?: string; tenant?: string; rootName?: string; fetch?: typeof fetch; now?: () => number };
type Tokens = { access: string; refresh: string; expires: number };
type Owner = { accountId: string; accountName?: string; driveId: string; rootId: string; rootName: string };
type State = { active?: boolean; owner?: Owner; tokens?: Tokens; pending?: Record<string, { session: string; verifier: string; expires: number }> };
const hash = (value: string) => createHash("sha256").update(value).digest("base64url");
const unavailable = () => new AppError("La conexión con OneDrive no está disponible. Pide al administrador que la conecte de nuevo.", 503);

export function createOneDriveConnection(config: Config) {
  const request = config.fetch || fetch;
  const now = config.now || Date.now;
  const rootName = config.rootName || "OneDriveList";
  const tenant = config.tenant || "consumers";
  let redirectUri: string | null = null;
  try {
    const url = new URL(config.redirectUri || "");
    if ((url.protocol === "https:" || url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) && !url.username && !url.password && !url.hash) redirectUri = url.href;
  } catch { /* Expose configuration status without breaking local storage. */ }
  const missing = [!config.clientId && "ONEDRIVE_CLIENT_ID", !config.clientSecret && "ONEDRIVE_CLIENT_SECRET", !redirectUri && "ONEDRIVE_REDIRECT_URI", !/^[a-zA-Z0-9.-]+$/.test(tenant) && "ONEDRIVE_TENANT", (!rootName.trim() || /[/\\:*?"<>|]/.test(rootName) || rootName === "." || rootName === "..") && "ONEDRIVE_ROOT_FOLDER"].filter(Boolean) as string[];
  const configured = missing.length === 0;
  const authority = `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0`;
  async function locked<T>(operation: (state: State, save: () => Promise<void>) => Promise<T>): Promise<T> {
    const directory = typeof config.directory === "string" ? config.directory : await config.directory();
    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
    return withDirectoryLock(path.join(directory, "onedrive.lock"), async () => {
      const keyPath = path.join(directory, "onedrive.key");
      let key: Buffer;
      try { key = await fs.readFile(keyPath); } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        key = randomBytes(32); await fs.writeFile(keyPath, key, { mode: 0o600, flag: "wx" });
      }
      if (key.length !== 32) throw unavailable();
      const filename = path.join(directory, "onedrive.enc");
      let state: State = {};
      try {
        const raw = await fs.readFile(filename);
        const decipher = createDecipheriv("aes-256-gcm", key, raw.subarray(0, 12));
        decipher.setAuthTag(raw.subarray(12, 28));
        state = JSON.parse(Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8"));
      } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw unavailable(); }
      const save = async () => {
        const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", key, iv);
        const encrypted = Buffer.concat([cipher.update(JSON.stringify(state), "utf8"), cipher.final()]);
        const temp = `${filename}.${randomUUID()}.tmp`;
        try { await fs.writeFile(temp, Buffer.concat([iv, cipher.getAuthTag(), encrypted]), { flag: "wx", mode: 0o600 }); await fs.rename(temp, filename); }
        finally { await fs.rm(temp, { force: true }); }
      };
      return operation(state, save);
    }, 30000);
  }
  async function token(body: URLSearchParams): Promise<Tokens> {
    if (!configured) throw unavailable();
    body.set("client_id", config.clientId!); body.set("client_secret", config.clientSecret!); body.set("scope", "Files.ReadWrite offline_access User.Read");
    let response: Response;
    try { response = await request(`${authority}/token`, { method: "POST", body, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(20000) }); } catch { throw unavailable(); }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (data.error === "invalid_grant") throw new AppError("La autorización de OneDrive ha caducado", 401);
      throw unavailable();
    }
    if (typeof data.access_token !== "string" || typeof data.refresh_token !== "string" || !Number.isFinite(Number(data.expires_in)) || Number(data.expires_in) <= 0) throw unavailable();
    return { access: data.access_token, refresh: data.refresh_token, expires: now() + Number(data.expires_in) * 1000 };
  }
  async function graph(access: string, suffix: string, init: RequestInit = {}) {
    let response: Response;
    try { response = await request(`https://graph.microsoft.com/v1.0${suffix}`, { ...init, headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(20000) }); } catch { throw unavailable(); }
    if (!response.ok) { if (response.status === 404) throw new AppError("Carpeta no encontrada en OneDrive", 404); throw unavailable(); }
    return response.json();
  }
  async function createAuthorization(sessionToken: string) {
    if (!configured || !sessionToken) throw unavailable();
    const state = randomBytes(32).toString("base64url"); const verifier = randomBytes(48).toString("base64url");
    await locked(async (data, save) => {
      data.pending = Object.fromEntries(Object.entries(data.pending || {}).filter(([, item]) => item.expires > now()));
      data.pending[hash(state)] = { session: hash(sessionToken), verifier, expires: now() + 600000 }; await save();
    });
    const query = new URLSearchParams({ client_id: config.clientId!, response_type: "code", redirect_uri: redirectUri!, response_mode: "query", scope: "Files.ReadWrite offline_access User.Read", state, code_challenge: hash(verifier), code_challenge_method: "S256", prompt: "select_account" });
    return `${authority}/authorize?${query}`;
  }
  async function completeAuthorization(input: { state: string; code: string; sessionToken: string }) {
    return locked(async (data, save) => {
      const pending = data.pending?.[hash(input.state)];
      if (!pending || pending.expires <= now() || pending.session !== hash(input.sessionToken) || !input.code) throw new AppError("Solicitud de conexión no válida o caducada", 400);
      delete data.pending![hash(input.state)]; await save();
      const tokens = await token(new URLSearchParams({ grant_type: "authorization_code", code: input.code, redirect_uri: redirectUri!, code_verifier: pending.verifier }));
      const profile = await graph(tokens.access, "/me"); const drive = await graph(tokens.access, "/me/drive");
      if (typeof profile.id !== "string" || typeof drive.id !== "string") throw unavailable();
      if (data.owner && (data.owner.accountId !== profile.id || data.owner.driveId !== drive.id)) throw new AppError("Conecta la cuenta propietaria original de este almacenamiento", 409);
      let folder;
      // Exact path lookup prevents trusting pagination links supplied by Graph.
      const suffix = `/drives/${encodeURIComponent(drive.id)}/root:/${encodeURIComponent(rootName)}`;
      try { folder = await graph(tokens.access, suffix); } catch (error) {
        if (data.owner || !(error instanceof AppError) || error.status !== 404) throw error;
        folder = await graph(tokens.access, `/drives/${encodeURIComponent(drive.id)}/root/children`, { method: "POST", body: JSON.stringify({ name: rootName, folder: {}, "@microsoft.graph.conflictBehavior": "fail" }) });
      }
      if (!folder.folder || typeof folder.id !== "string" || typeof folder.name !== "string" || folder.name.toLowerCase() !== rootName.toLowerCase()) throw unavailable();
      if (data.owner && data.owner.rootId !== folder.id) throw new AppError("La carpeta original de OneDrive ya no está disponible", 409);
      data.owner = { accountId: profile.id, accountName: typeof profile.displayName === "string" ? profile.displayName : undefined, driveId: drive.id, rootId: folder.id, rootName: folder.name };
      data.tokens = tokens; data.active = true; await save();
    });
  }
  async function getOneDriveAccessToken() {
    return locked(async (data, save) => {
      if (!data.active || !data.owner || !data.tokens || !configured) throw unavailable();
      if (data.tokens.expires > now() + 30000) return data.tokens.access;
      try { data.tokens = await token(new URLSearchParams({ grant_type: "refresh_token", refresh_token: data.tokens.refresh })); await save(); return data.tokens.access; }
      catch (error) { if (error instanceof AppError && error.status === 401) { delete data.tokens; await save(); } throw error; }
    });
  }
  return {
    createAuthorization, completeAuthorization, getOneDriveAccessToken,
    connectionStatus: () => locked(async data => ({ configured, connected: configured && !!data.active && !!data.owner && !!data.tokens, active: !!data.active, accountName: data.owner?.accountName, accountId: data.owner?.accountId, rootName: data.owner?.rootName || rootName, missing, redirectUri })),
    getStorageMode: (): Promise<"local" | "onedrive"> => locked(async data => data.active ? "onedrive" : "local"),
    getOneDriveConnection: () => locked(async data => data.owner ? { driveId: data.owner.driveId, rootId: data.owner.rootId, accountId: data.owner.accountId, rootName: data.owner.rootName } : null),
    disconnect: () => locked(async (data, save) => { delete data.tokens; data.pending = {}; await save(); }),
  };
}
let singleton: ReturnType<typeof createOneDriveConnection> | undefined;
function production() {
  return singleton ||= createOneDriveConnection({ directory: privateDataDirectory, clientId: process.env.ONEDRIVE_CLIENT_ID, clientSecret: process.env.ONEDRIVE_CLIENT_SECRET, redirectUri: process.env.ONEDRIVE_REDIRECT_URI, tenant: process.env.ONEDRIVE_TENANT, rootName: process.env.ONEDRIVE_ROOT_FOLDER });
}
export const connectionStatus = () => production().connectionStatus();
export const getStorageMode = () => production().getStorageMode();
export const getOneDriveConnection = () => production().getOneDriveConnection();
export const getOneDriveAccessToken = () => production().getOneDriveAccessToken();
export const createAuthorization = (sessionToken: string) => production().createAuthorization(sessionToken);
export const completeAuthorization = (input: { state: string; code: string; sessionToken: string }) => production().completeAuthorization(input);
export const disconnect = () => production().disconnect();


