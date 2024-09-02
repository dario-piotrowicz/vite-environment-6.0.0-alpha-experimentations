import type { ViteDevServer, Plugin } from 'vite';
import {
  cloudflareEnvironment,
  type DevEnvironment,
} from '@flarelabs-net/vite-environment-provider-cloudflare';
import { nodeProcessEnvironment } from '@flarelabs-net/vite-environment-provider-node-process';
import { nodeVMEnvironment } from '@flarelabs-net/vite-environment-provider-node-vm';
import type * as http from 'node:http';

const ssrEnvName = 'ssr-env';

export function dummyFramework({
  entrypoint,
  env,
}: {
  entrypoint: string;
  env: 'cloudflare' | 'node-process' | 'node-vm';
}): Plugin[] {
  const environmentPlugin =
    env === 'cloudflare'
      ? cloudflareEnvironment(ssrEnvName)
      : env === 'node-process'
        ? nodeProcessEnvironment(ssrEnvName)
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

        devEnv.hot.send('plugin-event', 'Hello from framework plugin');

        devEnv.hot.on('ssr-event', data => {
          console.log(
            `Received custom event (import.meta.hot.send is working). Payload value is '${data}'.`,
          );
        });

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
