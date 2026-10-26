import { requireUser } from "@/lib/authToken";
import { redirect } from "next/navigation";
import UsersPanel from "@/features/workspace/UsersPanel";

export default async function UsersPage() {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/");
  return <UsersPanel currentId={user.id} />;
}
