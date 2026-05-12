import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.CLOUDBASE_ENV_ID': JSON.stringify(env.CLOUDBASE_ENV_ID),
      'process.env.COZE_API_TOKEN': JSON.stringify(env.COZE_API_TOKEN),
      'process.env.COZE_ANALYSIS_BOT_ID': JSON.stringify(env.COZE_ANALYSIS_BOT_ID),
      'process.env.COZE_SEARCH_BOT_ID': JSON.stringify(env.COZE_SEARCH_BOT_ID),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
