import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";

export default function PublicShell({
  children,
  overlayHeader = false,
}: {
  children: React.ReactNode;
  overlayHeader?: boolean;
}) {
  if (overlayHeader) {
    return (
      <div className="flex min-h-screen flex-col mesh-bg">
        <div className="relative">
          <div className="absolute inset-x-0 top-0 z-40">
            <SiteHeader />
          </div>
          {children}
        </div>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col mesh-bg">
      <SiteHeader />
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </div>
  );
}
