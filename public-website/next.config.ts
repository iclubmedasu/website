import type { NextConfig } from "next";
import path from "path";

const FRAME_DENY_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
] as const;

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(process.cwd(), ".."),
  images: { unoptimized: true },
  allowedDevOrigins: ["192.168.*.*"],
  async headers() {
    return [
      {
        // Block framing everywhere except the embed widget route.
        // Negative lookahead excludes /embed and /embed/... from DENY headers.
        source: "/((?!embed(?:/|$)).*)",
        headers: [...FRAME_DENY_HEADERS],
      },
    ];
  },
};

export default nextConfig;
