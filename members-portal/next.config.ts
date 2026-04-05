import type { NextConfig } from 'next'
import withPWA from 'next-pwa'

const withPWAWrapped = withPWA({
    dest: 'public',
    register: true,
    skipWaiting: true,
    disable: process.env.NODE_ENV === 'development'
})

const nextConfig: NextConfig = {
    output: 'standalone',
    allowedDevOrigins: ['192.168.1.*'],
    images: {
        remotePatterns: [
            {
                protocol: 'http',
                hostname: 'localhost',
                port: '3000',
                pathname: '/api/**',
            },
            {
                protocol: 'https',
                hostname: '**',
            }
        ]
    },
}

export default withPWAWrapped(nextConfig)
