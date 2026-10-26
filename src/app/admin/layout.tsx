import { redirect } from "next/navigation";
import { requireUser } from "@/lib/authToken";
import AdminShell from "@/features/crm/AdminShell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/");
  return <AdminShell name={user.name}>{children}</AdminShell>;
}
