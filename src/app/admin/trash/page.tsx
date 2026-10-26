import { requireUser } from "@/lib/authToken";
import { redirect } from "next/navigation";
import TrashPanel from "@/features/workspace/TrashPanel";

export default async function TrashPage() {
  if ((await requireUser()).role !== "admin") redirect("/");
  return <TrashPanel />;
}
