import type { ViteDevServer, Plugin } from 'vite';
import {
  workerdEnvironment,
  type DevEnvironment,
} from '@dario-hacking/vite-6-alpha-environment-provider-workerd';
import { nodeProcessEnvironment } from '@dario-hacking/vite-6-alpha-environment-provider-node-process';
import type * as http from 'node:http';
import { nodeVMEnvironment } from '@dario-hacking/vite-6-alpha-environment-provider-node-vm';

const ssrEnvName = 'ssr-env';

export function dummyFramework({
  entrypoint,
  env,
}: {
  entrypoint: string;
  env: 'workerd' | 'node-process' | 'node-vm';
}): Plugin[] {
  const environmentPlugin =
    env === 'workerd'
      ? workerdEnvironment(ssrEnvName)
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
