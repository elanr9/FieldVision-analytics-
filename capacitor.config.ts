import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ai.fieldvision.analytics',
  appName: 'FV Analytics',
  webDir: 'ios-shell',
  backgroundColor: '#F7F8FA',
  server: {
    url: 'https://field-vision-analytics.vercel.app',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 6000,
      launchFadeOutDuration: 250,
      backgroundColor: '#F7F8FA',
    },
  },
};

export default config;
