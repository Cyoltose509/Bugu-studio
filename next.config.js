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
        hostname: "cdn.bugoostudio.com",
      },
    ],
  },
  experimental: {
    serverActions: {
      allowedOrigins: [
        "localhost:3000",
        "bugoostudio.com",
        "www.bugoostudio.com",
      ],
    },
  },
  // jose 在 Edge Runtime 会引用 Node.js API，标为外部包避免打包进 Edge bundle
  serverExternalPackages: ["jose"],
  // 旧路由重定向
  async redirects() {
    return [
      { source: "/projects/:slug", destination: "/works/:slug", permanent: true },
      // 旧域名 301 重定向到新域名
      {
        source: "/:path*",
        has: [{ type: "host", value: "bugu-studio.com" }],
        destination: "https://bugoostudio.com/:path*",
        permanent: true,
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.bugu-studio.com" }],
        destination: "https://bugoostudio.com/:path*",
        permanent: true,
      },
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
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://va.vercel-scripts.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://*.r2.cloudflarestorage.com https://*.r2.dev https://cdn.bugoostudio.com",
              "font-src 'self' data: https://fonts.gstatic.com",
              "media-src 'self' data: blob:",
              "connect-src 'self' https://bugoostudio.com https://www.bugoostudio.com https://*.vercel-insights.com https://vitals.vercel-insights.com",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
