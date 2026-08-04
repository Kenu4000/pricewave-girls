import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["playwright"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.suruga-ya.jp",
      },
      {
        protocol: "https",
        hostname: "www.suruga-ya.jp",
      },
    ],
  },
};

export default nextConfig;
