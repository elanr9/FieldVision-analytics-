import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  env: {
    // Unique per build. Lets stale webviews detect a new deploy and reload.
    NEXT_PUBLIC_BUILD_ID: Date.now().toString(36),
  },
};

export default nextConfig;
