import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['gappartment.test'],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "img.clerk.com" },
      { protocol: "https", hostname: "uploadthing.com" },
      { protocol: "https", hostname: "utfs.io" },
    ],
  },
};

export default nextConfig;
