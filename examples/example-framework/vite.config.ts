import type { ViteDevServer } from 'vite';
import { type WorkerdDevEnvironment, viteEnvironmentPluginWorkerd } from 'vite-environment-plugin-workerd';
import type * as http from 'node:http';

export function exampleFramework({ entrypoint }: { entrypoint: string}) {
  return {
    name: 'example-framework-plugin',

    configureServer(server: ViteDevServer) {
      const devEnv = server.environments["workerd"] as WorkerdDevEnvironment;

      return async () => {
        server.middlewares.use(async (req: http.IncomingMessage, res: http.ServerResponse) => {

          const dispatchRequest = await devEnv.api.createRequestDispatcher({
            entrypoint,
          });

            const url = `http://localhost${req.url ?? '/'}`;

            const nativeReq = new Request(url);
            const resp = await dispatchRequest(nativeReq);
            const html = await resp.text();
            const transformedHtml = await server.transformIndexHtml(
              url,
              html,
            );
            res.end(transformedHtml);
        })
      }
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
  plugins: [
    plugin(),
    exampleFramework({ entrypoint })
  ],
  build: {
    minify: false,
  },
};
