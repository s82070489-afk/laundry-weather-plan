import { defineConfig } from '@apps-in-toss/web-framework/config';
import { APP_NAME } from './src/config/appName.ts';

export default defineConfig({
  appName: APP_NAME,
  brand: {
    primaryColor: '#3182F6',
  },
  permissions: [],
  webBundleDir: 'dist',
});
