import { retailerLabel } from "@/lib/format";

const STORES = [
  "zigzag",
  "vega",
  "istore",
  "mobilecentre",
  "yerevanmobile",
  "allsell",
  "redstore",
  "ispace",
  "eldorado",
];

export default function StoreTrustBar() {
  return (
    <div className="border-b border-gray-100 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
            Comparing prices from
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {STORES.map((slug) => (
              <span
                key={slug}
                className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-600"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                {retailerLabel(slug)}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
