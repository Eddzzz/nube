import { requireUser } from "@/lib/authToken";
import { redirect } from "next/navigation";
import StoragePanel from "@/features/workspace/StoragePanel";

export default async function StoragePage() {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/");
  return <StoragePanel />;
}
