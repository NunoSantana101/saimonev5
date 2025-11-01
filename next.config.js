/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Enable runtime configuration for environment variables
  env: {
    NEXT_PUBLIC_CHATKIT_WORKFLOW_ID: process.env.NEXT_PUBLIC_CHATKIT_WORKFLOW_ID,
  },
};

export default nextConfig;
