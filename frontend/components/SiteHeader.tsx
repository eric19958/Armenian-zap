"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function SiteHeader({ admin = false }: { admin?: boolean }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (admin) return;
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [admin]);

  const solid = admin || scrolled;

  return (
    <header
      className={`sticky top-0 z-40 transition-all duration-300 ${
        solid
          ? "border-b border-gray-200/80 bg-white/95 shadow-sm shadow-gray-900/5 backdrop-blur-xl"
          : "border-b border-white/10 bg-transparent backdrop-blur-md"
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link
          href={admin ? "/admin" : "/"}
          className="group flex items-center gap-3"
        >
          <div
            className={`relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl shadow-md transition group-hover:shadow-lg ${
              solid
                ? "bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-600 shadow-violet-500/30 group-hover:shadow-violet-500/40"
                : "bg-white/15 shadow-black/20 ring-1 ring-white/20 group-hover:bg-white/25"
            }`}
          >
            <span className="text-[13px] font-black tracking-tighter text-white">
              ԻԿ
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span
                className={`text-[15px] font-extrabold tracking-tight transition ${
                  solid
                    ? "text-gray-900 group-hover:text-violet-600"
                    : "text-white group-hover:text-white/90"
                }`}
              >
                Inch Ka
              </span>
              {admin && (
                <span className="rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                  Admin
                </span>
              )}
            </div>
            <span
              className={`mt-0.5 block text-[10px] font-medium tracking-wide ${
                solid ? "text-gray-400" : "text-white/50"
              }`}
            >
              {admin ? "Scrape · review · catalog" : "ի՞նչ կա · Armenia prices"}
            </span>
          </div>
        </Link>

        <nav className="flex items-center gap-1 text-sm">
          {admin ? (
            <Link
              href="/"
              className="rounded-xl px-3 py-2 font-medium text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
            >
              ← Public site
            </Link>
          ) : (
            <>
              <Link
                href="/#products"
                className={`hidden rounded-xl px-3 py-2 font-semibold transition sm:inline ${
                  solid
                    ? "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                Browse
              </Link>
              <a
                href="/#compared"
                className={`hidden rounded-xl px-3 py-2 font-semibold transition md:inline ${
                  solid
                    ? "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                Best deals
              </a>
              <a
                href="/#products"
                className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                  solid
                    ? "bg-violet-600 text-white shadow-md shadow-violet-500/25 hover:bg-violet-700"
                    : "bg-white text-gray-900 shadow-lg shadow-black/20 hover:bg-gray-100"
                }`}
              >
                Compare prices
              </a>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
