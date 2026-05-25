import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['gappartment.test'],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "img.clerk.com" },
      // UploadThing legacy hosts (kept for older uploads already in the DB)
      { protocol: "https", hostname: "uploadthing.com" },
      { protocol: "https", hostname: "utfs.io" },
      // UploadThing v7+ uses per-app subdomains like `<appId>.ufs.sh`
      { protocol: "https", hostname: "*.ufs.sh" },
    ],
  },
};

export default nextConfig;
