/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["net-snmp", "@prisma/client", "bcryptjs"],
  eslint: { ignoreDuringBuilds: true },
};

module.exports = nextConfig;
