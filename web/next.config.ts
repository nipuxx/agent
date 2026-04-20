import type { NextConfig } from "next";

const nipuxdUrl =
  (process.env.NIPUXD_URL || process.env.NEXT_PUBLIC_NIPUXD_URL || "http://127.0.0.1:9384").replace(/\/$/, "");

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  async rewrites() {
    return [
      {
        source: "/api/nipux/:path*",
        destination: `${nipuxdUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
