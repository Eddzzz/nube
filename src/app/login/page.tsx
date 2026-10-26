import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppError } from "@/lib/errors";
import { currentUser, SESSION_COOKIE, workspaceStore } from "@/lib/authToken";
import { SESSION_SECONDS } from "@/services/workspace-store";
import LoginUI from "./LoginView";

function safeNext(value: unknown): string | undefined {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !/[\\\u0000-\u0020\u007f]/.test(value) ? value : undefined;
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const nextPath = safeNext((await searchParams).next);
  const existing = await currentUser().catch(() => null);
  if (existing) redirect(nextPath || (existing.role === "admin" ? "/admin" : "/project"));
  async function login(formData: FormData) {
    "use server";
    const username = formData.get("username");
    const password = formData.get("password");
    if (typeof username !== "string" || typeof password !== "string") return { error: "Ingresa tu usuario y contraseña" };
    let token: string;
    let destination: string;
    try {
      // One shared per-account throttle; forwarding headers from LAN clients are untrusted.
      const result = await (await workspaceStore()).authenticate(username, password, "local");
      token = result.token;
      destination = safeNext(formData.get("next")) || (result.user.role === "admin" ? "/admin" : "/project");
    } catch (error) {
      return { error: error instanceof AppError ? error.message : "No se pudo iniciar sesión. Revisa la configuración del servidor." };
    }
    const jar = await cookies();
    jar.set(SESSION_COOKIE, token, { httpOnly: true, secure: process.env.AUTH_URL?.startsWith("https://") === true, sameSite: "lax", path: "/", maxAge: SESSION_SECONDS });
    jar.delete("pwd-auth");
    jar.delete("pwd-role");
    redirect(destination);
  }
  return <LoginUI loginAction={login} nextPath={nextPath} />;
}
