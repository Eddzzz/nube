import { NextResponse } from "next/server";
import { SESSION_COOKIE, workspaceStore, assertSameOrigin } from "@/lib/authToken";
import { cookies } from "next/headers";
import { toErrorResponse } from "@/lib/errors";

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const jar = await cookies();
    await (await workspaceStore()).logout(jar.get(SESSION_COOKIE)?.value);
    const response = NextResponse.json({ success: true });
    for (const name of [SESSION_COOKIE, "pwd-auth", "pwd-role"]) {
      response.cookies.set(name, "", { httpOnly: true, sameSite: "lax", secure: process.env.AUTH_URL?.startsWith("https://") === true, maxAge: 0, path: "/" });
    }
    return response;
  } catch (error) { return toErrorResponse(error); }
}
