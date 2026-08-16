import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: false,
  agentRules: false,
  outputFileTracingIncludes: {
    '/*': ['./src/skills/**/*']
  }
}

export default nextConfig
