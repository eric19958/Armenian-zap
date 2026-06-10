import AdminPanel from "@/components/AdminPanel";
import AdminShell from "@/components/AdminShell";
import { isAdminSession } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin — Inch Ka",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const authed = isAdminSession();
  return (
    <AdminShell>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <AdminPanel authed={authed} />
      </main>
    </AdminShell>
  );
}
