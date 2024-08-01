import {
  ModuleRunner,
  ESModulesEvaluator,
  RemoteRunnerTransport,
} from 'vite/module-runner';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import getPort from 'get-port';
import { processParentEvent, createChildEvent } from '../events';

async function getModuleRunner(root: string) {
  return new ModuleRunner(
    {
      root,
      transport: new RemoteRunnerTransport({
        send: data => {
          process.stdout.write(createChildEvent('transport', data));
        },
        onMessage: listener => {
          process.stdin.on('data', data => {
            processParentEvent(data, event => {
              if (event.type === 'transport') {
                listener(event.data);
              }
            });
          });
        },
      }),
      hmr: {
        connection: {
          isReady: () => true,
          onUpdate: callback => {
            process.stdin.on('data', data => {
              processParentEvent(data, event => {
                if (event.type === 'hmr') {
                  callback(event.data);
                }
              });
            });
          },
          send: () => {},
        },
      },
    },
    new ESModulesEvaluator(),
  );
}

process.stdin.on('data', async data => {
  processParentEvent(data, async event => {
    if (event.type === 'initialize') {
      const { root, entrypoint } = event.data;
      const moduleRunner = await getModuleRunner(root);
      const entry = await moduleRunner.import(entrypoint);
      const app = new Hono();

      app.all('*', c => {
        return entry.default(c.req.raw);
      });

      serve({ fetch: app.fetch, port: await getPort() }, ({ port }) => {
        process.stdout.write(createChildEvent('initialized', { port }));
      });
    }
  });
});
