"use client";

import { useEffect, useRef } from "react";

interface Props {
  value: string;
  onChange: (value: string) => void;
  resultCount: number;
  placeholder?: string;
}

export default function SearchBar({
  value,
  onChange,
  resultCount,
  placeholder = "Search by product or brand… e.g. MacBook Pro, Samsung Galaxy",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <div className="w-full">
      <div className="relative">
        <svg
          className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>

        <input
          ref={inputRef}
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label="Search products"
          className="w-full rounded-2xl border-2 border-gray-200 bg-white py-3.5 pl-12 pr-28 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-violet-400 focus:ring-4 focus:ring-violet-50"
        />

        {value ? (
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl bg-gray-200 px-3 py-1.5 text-xs font-bold text-gray-700 transition hover:bg-gray-300"
          >
            Clear ✕
          </button>
        ) : (
          <div className="absolute right-3 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded-lg border border-gray-200 bg-white px-2 py-1 text-[10px] font-bold text-gray-400 sm:flex">
            <span>⌘</span>
            <span>K</span>
          </div>
        )}
      </div>

      {value.trim() !== "" && (
        <p className="mt-2 pl-1 text-xs font-medium text-gray-500">
          <span className="font-black text-violet-600">{resultCount}</span>{" "}
          result{resultCount === 1 ? "" : "s"} for{" "}
          <span className="font-semibold text-gray-800">
            &ldquo;{value.trim()}&rdquo;
          </span>
        </p>
      )}
    </div>
  );
}
