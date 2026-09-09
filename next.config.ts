import type { NextConfig } from "next";

export function launchSecurityHeaders(environment = process.env.NODE_ENV) {
  const directives = ["default-src 'self'", "base-uri 'self'", "form-action 'self' https://accounts.google.com", "frame-ancestors 'none'", "object-src 'none'", "script-src 'self' 'unsafe-inline'", "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob: https:", "font-src 'self' data:", "media-src 'self' data: blob: https:", "connect-src 'self' https:", "worker-src 'self' blob:"];
  if (environment === 'production') directives.push('upgrade-insecure-requests');
  const headers = [
    { key: 'Content-Security-Policy', value: directives.join('; ') },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
    { key: 'X-Frame-Options', value: 'DENY' },
  ];
  if (environment === 'production') headers.push({ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' });
  return headers;
}

const nextConfig: NextConfig = {
  output: 'standalone',
  async headers() {
    return [{ source: '/:path*', headers: launchSecurityHeaders() }];
  },
};

export default nextConfig;
