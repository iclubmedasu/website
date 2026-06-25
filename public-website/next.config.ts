import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(process.cwd(), ".."),
  images: { unoptimized: true },
  allowedDevOrigins: ["192.168.*.*"],
};

export default nextConfig;
