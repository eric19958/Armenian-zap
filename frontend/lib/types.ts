// Inch Ka · shared types — mirror of the inch_ka.v_product_comparison view.

export interface RetailerOffer {
  retailer: string;   // slug, e.g. "zigzag"
  price: number;
  in_stock: boolean;
  url: string;
}

export interface PriceHistoryPoint {
  product_id: string;
  retailer_slug: string;
  retailer_name: string;
  price: number;
  in_stock: boolean;
  observed_at: string; // ISO timestamp
}

export interface ComparisonProduct {
  product_id: string;
  brand: string | null;
  canonical_name: string;
  category: string | null;
  image_url: string | null;
  offer_count: number;
  retailer_count: number;
  best_price: number | null;   // cheapest IN-STOCK price (from the view)
  highest_price: number | null;
  offers: RetailerOffer[];
}
