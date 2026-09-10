/** @type {import('next').NextConfig} */
const nextConfig = process.env.SONGDEE_WINDOWS_HOSTING === '1' ? {
  output: 'standalone',
  skipProxyUrlNormalize: true,
} : {};
export default nextConfig;
