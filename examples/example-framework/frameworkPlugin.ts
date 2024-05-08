import type { ViteDevServer } from 'vite';
import { type WorkerdDevEnvironment } from 'vite-environment-plugin-workerd';
import type * as http from 'node:http';
import { NodeVMDevEnvironment } from 'vite-environment-plugin-node-vm';

export function exampleFramework({ entrypoint }: { entrypoint: string }) {
  return {
    name: 'example-framework-plugin',

    async configureServer(server: ViteDevServer) {
      const devEnvNodeVm = server.environments['node-vm'] as
        | undefined
        | NodeVMDevEnvironment;
      const devEnvWorkerd = server.environments['workerd'] as
        | undefined
        | WorkerdDevEnvironment;

      let handler: RequestHandler;

      if (devEnvNodeVm) {
        handler = await devEnvNodeVm.api.getNodeHandler({
          entrypoint,
        });
      } else if (devEnvWorkerd) {
        handler = await devEnvWorkerd.api.getWorkerdHandler({
          entrypoint,
        });
      } else {
        throw new Error(
          'Neither the workerd nor node-vm environment was detected',
        );
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
