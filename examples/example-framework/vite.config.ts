import type { UserConfig, ViteDevServer } from 'vite';
import { type WorkerdDevEnvironment, viteEnvironmentPluginWorkerd } from 'vite-environment-plugin-workerd';
import type * as http from 'node:http';

export function exampleFramework({ entrypoint }: { entrypoint: string}) {
  return {
    name: 'example-framework-plugin',

    configureServer(server: ViteDevServer) {
      const devEnv = server.environments["workerd"] as WorkerdDevEnvironment;

      return async () => {
        server.middlewares.use(async (req: http.IncomingMessage, res: http.ServerResponse) => {
          const handler = await devEnv.api.getWorkerdHandler({
            entrypoint,
          });

            const url = `http://localhost${req.url ?? '/'}`;

            const nativeReq = new Request(url);
            const resp = await handler(nativeReq);
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

const config: UserConfig = {
  appType: 'custom',
  ssr: {
    target: 'webworker',
  },
  dev: {
    preTransformRequests: false,
  },
  server: {
    // TODO: without this (deprecated) setting we get an error in the terminal, investigate
    //       why that is, and also why dev.preTransformRequests doesn't work
    preTransformRequests: false,
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

export default config;