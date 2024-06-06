import type { ViteDevServer, Plugin } from 'vite';
import {
  workerdEnvironment,
  type DevEnvironment,
} from '@dario-hacking/vite-6-alpha-environment-provider-workerd';
import type * as http from 'node:http';
import { nodeVMEnvironment } from '@dario-hacking/vite-6-alpha-environment-provider-node-vm';

const ssrEnvName = 'ssr-env';

export function dummyFramework({
  entrypoint,
  env,
}: {
  entrypoint: string;
  env: 'workerd' | 'node-vm';
}): Plugin[] {
  const environmentPlugin =
    env === 'workerd'
      ? workerdEnvironment(ssrEnvName)
      : nodeVMEnvironment(ssrEnvName);

  return [
    ...environmentPlugin,
    {
      name: 'example-framework-plugin',

      async configureServer(server: ViteDevServer) {
        const devEnv = server.environments[ssrEnvName] as
          | undefined
          | DevEnvironment;

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
              const transformedHtml = await server.transformIndexHtml(
                url,
                html,
              );
              res.end(transformedHtml);
            },
          );
        };
      },
    },
  ];
}

type RequestHandler = (req: Request) => Response | Promise<Response>;
