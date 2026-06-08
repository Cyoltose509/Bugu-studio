/** @type {import('next').NextConfig} */
const nextConfig = {
  // ❌ 移除 output: 'standalone' — Vercel 不需要，会导致部署失败
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24, // 24h — 减少重复优化请求
    deviceSizes: [640, 768, 1024, 1280, 1536],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.r2.cloudflarestorage.com",
      },
      {
        protocol: "https",
        hostname: "*.r2.dev",
      },
      {
        protocol: "https",
        hostname: "*.cloudflare.com",
      },
      {
        protocol: "https",
        hostname: "cdn.bugu-studio.com",
      },
    ],
  },
  experimental: {
    serverActions: {
      allowedOrigins: [
        "localhost:3000",
        "bugu-studio.com",
        "www.bugu-studio.com",
      ],
    },
  },
  // jose 在 Edge Runtime 会引用 Node.js API，标为外部包避免打包进 Edge bundle
  serverExternalPackages: ["jose"],
  // 旧路由重定向
  async redirects() {
    return [
      { source: "/projects/:slug", destination: "/works/:slug", permanent: true },
    ];
  },
  // Security headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://*.r2.cloudflarestorage.com https://*.r2.dev https://cdn.bugu-studio.com",
              "font-src 'self' data: https://fonts.gstatic.com",
              "media-src 'self' data: blob:",
              "connect-src 'self' https://bugu-studio.com https://www.bugu-studio.com",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
