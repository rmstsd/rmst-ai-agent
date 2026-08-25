import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: false,
  agentRules: false,
  allowedDevOrigins: ['172.16.87.41'],
  outputFileTracingIncludes: {
    '/*': ['./src/skills/**/*']
  }
}

export default nextConfig
