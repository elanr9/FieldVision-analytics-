import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ai.fieldvision.analytics',
  appName: 'FV Analytics',
  webDir: 'ios-shell',
  server: {
    url: 'https://field-vision-analytics.vercel.app',
  },
};

export default config;
