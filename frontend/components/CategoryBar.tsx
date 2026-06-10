"use client";

import { CATEGORY_GROUPS } from "@/lib/categories";
import type { CategoryOption } from "@/components/CategoryFilter";

const CATEGORY_ICONS: Record<string, string> = {
  notebook: "💻",
  laptop: "💻",
  smartphone: "📱",
  phone: "📱",
  tablet: "📲",
  smartwatch: "⌚",
  tv: "📺",
  av_tv: "📺",
  refrigerator: "🧊",
  washing_machine: "🫧",
  air_conditioner: "❄️",
  kitchen_appliance: "🍳",
  vacuum_cleaner: "🌀",
  home_appliance: "🏠",
  gaming: "🎮",
  desktop: "🖥️",
  printer: "🖨️",
  accessory: "🔌",
  other: "📦",
};

interface Props {
  options: CategoryOption[];
  active: string;
  onChange: (key: string) => void;
}

function Chip({
  opt,
  active,
  onChange,
}: {
  opt: CategoryOption;
  active: string;
  onChange: (key: string) => void;
}) {
  const isActive = opt.key === active;
  const icon = CATEGORY_ICONS[opt.key];
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      onClick={() => onChange(opt.key)}
      className={
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition-all " +
        (isActive
          ? "bg-violet-600 text-white shadow-md shadow-violet-500/30"
          : "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900")
      }
    >
      {icon && <span className="text-[13px] leading-none">{icon}</span>}
      {opt.label}
      <span
        className={
          "rounded-full px-1.5 text-[10px] font-bold tabular-nums " +
          (isActive ? "bg-white/20 text-white" : "bg-white text-gray-500")
        }
      >
        {opt.count}
      </span>
    </button>
  );
}

export default function CategoryBar({ options, active, onChange }: Props) {
  if (options.length <= 1) return null;

  const all = options.filter((o) => o.key === "all");
  const grouped = CATEGORY_GROUPS.map((group) => ({
    label: group.label,
    pills: options.filter((o) => group.keys.includes(o.key)),
  })).filter((g) => g.pills.length > 0);
  const other = options.filter((o) => o.key === "other");

  return (
    <div
      className="overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="tablist"
      aria-label="Filter by category"
    >
      <div className="flex min-w-max items-center gap-2">
        {all.map((opt) => (
          <Chip key={opt.key} opt={opt} active={active} onChange={onChange} />
        ))}

        {grouped.map((group) => (
          <div key={group.label} className="flex items-center gap-2">
            <div className="mx-1 h-5 w-px shrink-0 bg-gray-200" aria-hidden />
            {group.pills.map((opt) => (
              <Chip key={opt.key} opt={opt} active={active} onChange={onChange} />
            ))}
          </div>
        ))}

        {other.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="mx-1 h-5 w-px shrink-0 bg-gray-200" aria-hidden />
            {other.map((opt) => (
              <Chip key={opt.key} opt={opt} active={active} onChange={onChange} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
