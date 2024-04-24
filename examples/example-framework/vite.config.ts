import type { ViteDevServer } from 'vite';
import { viteEnvironmentPluginWorkerd } from 'vite-environment-plugin-workerd';

export function exampleFramework({ entrypoint }: { entrypoint: string}) {
  return {
    name: 'example-framework-plugin',
    configureServer(server: ViteDevServer) {
      return async () => {
        server.middlewares.use(async (req, res) => {
          const transformedHtml = `TODO<run -> ${entrypoint}>`;
          res.end(transformedHtml);
        });
      };
    },
  };
}

const plugin = viteEnvironmentPluginWorkerd;
const entrypoint = './entry-workerd.ts';

/** @type {import('vite').UserConfig} */
export default {
  appType: 'custom',
  ssr: {
    target: 'webworker',
  },
  optimizeDeps: {
    include: [],
  },
  plugins: [plugin(), exampleFramework({ entrypoint })],
  build: {
    minify: false,
  },
};
