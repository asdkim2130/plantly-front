import type { NextConfig } from "next";

// 백엔드(Spring)는 별도 프로세스로 8080 에서 돈다. /api/* 를 그쪽으로 프록시해서
// 브라우저 입장에서는 모두 같은 오리진(localhost:3000)이 되게 한다.
//
// 이렇게 하면 세션 쿠키(JSESSIONID)와 CSRF 쿠키(XSRF-TOKEN)가 별도 설정 없이 그대로 붙고,
// CORS 프리플라이트도 타지 않는다. 프론트 코드에서는 항상 상대경로("/api/v1/...")만 쓴다.
const BACKEND_ORIGIN = process.env.BACKEND_ORIGIN ?? "http://localhost:8080";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${BACKEND_ORIGIN}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;