import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-white/10 bg-gradient-to-br from-violet-950 via-[#1a0e3d] to-indigo-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-3">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-sm font-black ring-1 ring-white/20">
                ԻԿ
              </div>
              <span className="text-lg font-extrabold tracking-tight">
                Inch Ka
              </span>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/50">
              Armenia&apos;s price comparison for electronics and home
              appliances. Never overpay again.
            </p>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-white/35">
              Browse
            </p>
            <div className="mt-4 flex flex-col gap-3">
              <Link
                href="/#products"
                className="text-sm font-medium text-white/60 transition hover:text-white"
              >
                All products
              </Link>
              <a
                href="/#compared"
                className="text-sm font-medium text-white/60 transition hover:text-white"
              >
                Best deals
              </a>
            </div>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-white/35">
              Info
            </p>
            <div className="mt-4 flex flex-col gap-2.5 text-sm text-white/50">
              <p>Prices in Armenian drams (֏)</p>
              <p>Catalog updated daily</p>
              <p>Zigzag · Vega · iStore · Mobile Centre & more</p>
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-6">
          <p className="text-xs text-white/30">
            © {new Date().getFullYear()} Inch Ka · ի՞նչ կա
          </p>
          <p className="text-xs text-white/30">
            Verified daily across Armenian stores
          </p>
        </div>
      </div>
    </footer>
  );
}
