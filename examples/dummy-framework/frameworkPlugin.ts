import type { UserConfig, ViteDevServer } from 'vite';
import {
  workerdEnvironmentProvider,
  type DevEnvironment,
} from '@dario-hacking/vite-6-alpha-environment-provider-workerd';
import type * as http from 'node:http';
import { nodeVMEnvironmentProvider } from '@dario-hacking/vite-6-alpha-environment-provider-node-vm';

export function dummyFramework({
  entrypoint,
  env,
}: {
  entrypoint: string;
  env: 'workerd' | 'node-vm';
}) {
  return {
    name: 'example-framework-plugin',

    async config(config: UserConfig) {
      return {
        environments: {
          ssr: await (env === 'workerd'
            ? workerdEnvironmentProvider()
            : nodeVMEnvironmentProvider()),
        },
      };
    },

    async configureServer(server: ViteDevServer) {
      const devEnv = server.environments.ssr as undefined | DevEnvironment;

      let handler: RequestHandler;

      if (devEnv) {
        handler = await devEnv.api.getHandler({
          entrypoint,
        });
      } else {
        throw new Error('No ssr environment was detected');
      }

      return async () => {
        server.middlewares.use(
          async (req: http.IncomingMessage, res: http.ServerResponse) => {
            const url = `http://localhost${req.url ?? '/'}`;

            const nativeReq = new Request(url);
            const resp = await handler(nativeReq);
            const html = await resp.text();
            const transformedHtml = await server.transformIndexHtml(url, html);
            res.end(transformedHtml);
          },
        );
      };
    },
  };
}

type RequestHandler = (req: Request) => Response | Promise<Response>;
