/** @type {import('next').NextConfig} */
const nextConfig = {
  // 빌드 시점에 외부 이미지 도메인 허용 — Firebase Storage, 백엔드, CDN 등.
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.googleusercontent.com' },
      { protocol: 'https', hostname: 'firebasestorage.googleapis.com' },
      { protocol: 'https', hostname: 'yojalal.com' },
      { protocol: 'https', hostname: 'devl-backend-879574205436.asia-northeast3.run.app' },
    ],
    // Cloudflare Pages는 Next 기본 이미지 최적화 서버를 못 돌리므로 unoptimized로 처리.
    unoptimized: true,
  },
  // 단순화: ESLint·TypeScript 빌드 실패 무시 (CI는 별도로 둠).
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
};

module.exports = nextConfig;
