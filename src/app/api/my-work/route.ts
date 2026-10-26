import type { NextRequest } from "next/server";
import { apiUser, assertSameOrigin, workspaceStore } from "@/lib/authToken";
import { toErrorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await apiUser(req);
    return Response.json({ ...await (await workspaceStore()).getMyWork(user), user });
  } catch (error) { return toErrorResponse(error); }
}

export async function PATCH(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const user = await apiUser(req);
    return Response.json({ ...await (await workspaceStore()).updateMyWork(user, await req.json()), user });
  } catch (error) { return toErrorResponse(error); }
}
