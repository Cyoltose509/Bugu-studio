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
      // OAuth 头像域名 — 使 next/Image 能优化用户头像
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
      {
        protocol: "https",
        hostname: "*.githubusercontent.com",
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
  // jose / isomorphic-dompurify 及其依赖链 (jsdom → html-encoding-sniffer → @exodus/bytes)
  // 包含 ESM-only 子依赖，必须标为外部包避免 webpack 打包时报 ERR_REQUIRE_ESM
  serverExternalPackages: [
    "jose",
    "isomorphic-dompurify",
    "jsdom",
    "html-encoding-sniffer",
    "@exodus/bytes",
  ],
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
    const isDev = process.env.NODE_ENV === "development";
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // 生产环境禁用 unsafe-eval；开发模式 Next.js HMR 需要
              isDev
                ? "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://va.vercel-scripts.com"
                : "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://*.r2.cloudflarestorage.com https://*.r2.dev https://cdn.bugoostudio.com https://lh3.googleusercontent.com https://avatars.githubusercontent.com https://*.githubusercontent.com",
              "font-src 'self' data: https://fonts.gstatic.com",
              "media-src 'self' data: blob:",
              "connect-src 'self' https://bugoostudio.com https://www.bugoostudio.com https://*.vercel-insights.com https://vitals.vercel-insights.com",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
