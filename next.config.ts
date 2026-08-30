import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fully static export: every route becomes prerendered HTML/JS with no
  // server runtime, so it can be served from a CDN (Vercel/Cloudflare).
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
