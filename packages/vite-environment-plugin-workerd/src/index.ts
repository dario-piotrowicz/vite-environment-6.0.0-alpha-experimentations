import { type ViteDevServer } from 'vite';

export function viteRuntimeWorkerd() {
  return {
    name: 'vite-runtime-workerd-plugin',
    async configureServer(server: ViteDevServer) {
      console.log('TODO');
    },
  };
}
