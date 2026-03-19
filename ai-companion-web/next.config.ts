import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'xorpay.com',
        pathname: '/qr**',
      },
    ],
  },
};

export default nextConfig;
