import type { NextConfig } from "next";

const backend =
  process.env.ARONNO_API_ORIGIN?.replace(/\/$/, "") || "http://localhost:3000";

const nextConfig: NextConfig = {
  async rewrites() {
    // Fallback only — preferred path is the BFF proxy at /api/[...path]
    // which forwards cookies + CSRF. Keep rewrite unused for mutations.
    return [];
  },
  env: {
    ARONNO_API_ORIGIN: backend,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "**.cloudinary.com" },
      { protocol: "http", hostname: "localhost" },
      { protocol: "http", hostname: "127.0.0.1" },
    ],
  },
};

export default nextConfig;
