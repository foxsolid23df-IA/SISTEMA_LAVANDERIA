import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.foxsolid.lavanderia.chofer',
  appName: 'FoxSolid Chofer',
  webDir: '../dist',
  plugins: {
    StatusBar: {
      overlaysWebView: true,
      style: 'DARK',
      backgroundColor: '#0f172a'
    },
    Keyboard: {
      resize: 'body',
      style: 'DARK',
      resizeOnFullScreen: true
    },
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: '#0f172a'
    }
  },
  server: {
    androidScheme: 'https',
    allowNavigation: []
  },
  android: {
    allowMixedContent: true
  }
};

export default config;
