/** @type {import('next').NextConfig} */
const repo = "wc2026-break-analyzer";
const nextConfig = {
  output: "export",
  basePath: `/${repo}`,
  assetPrefix: `/${repo}/`,
  eslint: { ignoreDuringBuilds: true },
  images: { unoptimized: true },
  env: { NEXT_PUBLIC_BASE_PATH: `/${repo}` },
};
export default nextConfig;
