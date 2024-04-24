import { type ViteDevServer } from 'vite';

export function viteEnvironmentPluginWorkerd() {
  return {
    name: 'vite-environment-plugin-workerd',
    async configureServer(server: ViteDevServer) {
      console.log('[vite-environment-plugin-workerd] TODO');
    },
  };
}
