import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth/guards";

/** Redirige tras el login según el rol. */
export default async function AccountRouter() {
  const user = await requireUser();
  redirect(user.role === "CUSTOMER" ? "/mi-cuenta" : "/panel");
}
