import { searchItems } from "@/services/onedrive/repo";
import { toErrorResponse } from "@/lib/errors";
import { apiUser } from "@/lib/authToken";
import { visibleItems } from "@/services/scoped-drive";
import type { NextRequest } from "next/server";

export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const user = await apiUser(req);
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    if (!q) return Response.json({ value: [] });
    const data = await searchItems(q);
    return Response.json({ value: visibleItems(user, data.value) });
  } catch (error) {
    return toErrorResponse(error);
  }
}
