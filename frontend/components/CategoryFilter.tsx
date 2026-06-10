"use client";

export interface CategoryOption {
  key: string;     // "all" or a category key
  label: string;
  count: number;
}

interface Props {
  options: CategoryOption[];
  active: string;
  onChange: (key: string) => void;
}

export default function CategoryFilter({ options, active, onChange }: Props) {
  if (options.length <= 1) return null; // nothing to filter by

  return (
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter by category">
      {options.map((opt) => {
        const isActive = opt.key === active;
        return (
          <button
            key={opt.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(opt.key)}
            className={
              "inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition " +
              (isActive
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50")
            }
          >
            {opt.label}
            <span
              className={
                "rounded-full px-1.5 text-[11px] font-semibold " +
                (isActive ? "bg-white/25 text-white" : "bg-gray-100 text-gray-500")
              }
            >
              {opt.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
