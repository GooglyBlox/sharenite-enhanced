/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['images.igdb.com', 'sharenite.link'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.*.*',
      }
    ]
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