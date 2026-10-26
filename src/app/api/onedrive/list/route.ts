import { listForUser } from "@/services/scoped-drive";
import { apiUser } from "@/lib/authToken";
import type { NextRequest } from "next/server";
import { toErrorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const data = await listForUser(await apiUser(req), req.nextUrl.searchParams.get("parentId") || "");
    return Response.json(data);
  } catch (error) {
    return toErrorResponse(error);
  }
}
