import { actor } from "@/lib/auth";
import { redirect } from "next/navigation";
export default async function Page() {
  try {
    await actor();
  } catch {
    redirect("/login");
  }
  redirect("/app/dashboard");
}
