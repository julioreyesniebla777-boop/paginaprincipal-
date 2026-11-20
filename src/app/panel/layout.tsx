import { requireStaff } from "@/server/auth/guards";
import { getBusiness } from "@/server/business";
import { logoutAction } from "@/server/actions/auth";
import { PanelShell } from "@/components/panel/shell";

export const metadata = { robots: { index: false } };

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const [user, business] = await Promise.all([requireStaff(), getBusiness()]);
  return (
    <PanelShell businessName={business.name} user={{ name: user.name, role: user.role, employeeId: user.employeeId }} logout={logoutAction}>
      {children}
    </PanelShell>
  );
}
