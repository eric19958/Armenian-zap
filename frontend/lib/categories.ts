// Inch Ka · canonical category taxonomy (mirrors scrapers/category_hints.py)

export const CATEGORY_ORDER: string[] = [
  "smartphone",
  "tablet",
  "smartwatch",
  "notebook",
  "desktop",
  "tv",
  "gaming",
  "printer",
  "refrigerator",
  "washing_machine",
  "air_conditioner",
  "kitchen_appliance",
  "vacuum_cleaner",
  "home_appliance",
  "accessory",
  "other",
];

export const CATEGORY_GROUPS: { label: string; keys: string[] }[] = [
  {
    label: "Phones & wearables",
    keys: ["smartphone", "tablet", "smartwatch"],
  },
  {
    label: "Computers",
    keys: ["notebook", "laptop", "desktop", "printer"],
  },
  {
    label: "TV & gaming",
    keys: ["tv", "av_tv", "gaming"],
  },
  {
    label: "Home & kitchen",
    keys: [
      "refrigerator",
      "washing_machine",
      "air_conditioner",
      "kitchen_appliance",
      "vacuum_cleaner",
      "home_appliance",
    ],
  },
];

export function categorySortIndex(key: string): number {
  const i = CATEGORY_ORDER.indexOf(key);
  return i >= 0 ? i : CATEGORY_ORDER.length;
}
