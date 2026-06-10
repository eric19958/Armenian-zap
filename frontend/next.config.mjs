/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      // Self-hosted product images (Supabase Storage) — primary source.
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
      // Retailer CDNs — fallback for any image not yet cached locally.
      { protocol: "https", hostname: "**.am" },
      { protocol: "https", hostname: "*.am" },
    ],
  },
};

export default nextConfig;
