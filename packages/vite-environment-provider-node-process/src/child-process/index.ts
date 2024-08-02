import {
  ModuleRunner,
  ESModulesEvaluator,
  RemoteRunnerTransport,
} from 'vite/module-runner';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import getPort from 'get-port';
import {
  createEventSender,
  createEventProcessor,
  type ChildEvent,
  type ParentEvent,
} from '../events';

const sendChildEvent = createEventSender<ChildEvent>(event => {
  process.stdout.write(event);
});
const parentEvent = createEventProcessor<ParentEvent>(listen => {
  process.stdin.on('data', listen);
});

async function getModuleRunner(root: string) {
  return new ModuleRunner(
    {
      root,
      transport: new RemoteRunnerTransport({
        send: data => {
          sendChildEvent('transport', data);
        },
        onMessage: listener => {
          parentEvent.addListener(event => {
            if (event.type === 'transport') {
              listener(event.data);
            }
          });
        },
      }),
      hmr: {
        connection: {
          isReady: () => true,
          onUpdate: callback => {
            parentEvent.addListener(event => {
              if (event.type === 'hmr') {
                callback(event.data);
              }
            });
          },
          send: () => {},
        },
      },
    },
    new ESModulesEvaluator(),
  );
}

parentEvent.addListener(async event => {
  if (event.type === 'initialize') {
    const { root, entrypoint } = event.data;
    const moduleRunner = await getModuleRunner(root);
    const entry = await moduleRunner.import(entrypoint);
    const app = new Hono();

    app.all('*', c => {
      return entry.default(c.req.raw);
    });

    serve({ fetch: app.fetch, port: await getPort() }, ({ port }) => {
      sendChildEvent('initialized', { port });
    });
  }
});
