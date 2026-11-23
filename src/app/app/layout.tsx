import { actor } from "@/lib/auth";
import { redirect } from "next/navigation";
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await actor();
  } catch {
    redirect("/login");
  }
  return children;
}
