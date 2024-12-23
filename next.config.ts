import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    domains: ['images.igdb.com', 'sharenite.link']
  },
  async redirects() {
    return [
      {
        source: '/profile',
        destination: '/',
        permanent: true,
      },
    ];
  }
};

export default nextConfig;