import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";

export default function AdminShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-[#f6f7f9]">
      <SiteHeader admin />
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </div>
  );
}
