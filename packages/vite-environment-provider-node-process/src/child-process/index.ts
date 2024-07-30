import {
  ModuleRunner,
  ESModulesEvaluator,
  RemoteRunnerTransport,
} from 'vite/module-runner';
import { processParentEvent, createChildEvent } from '../events';
import { responseToObject } from '../utils';

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

let entry;

process.stdin.on('data', async data => {
  processParentEvent(data, async event => {
    switch (event.type) {
      case 'initialize': {
        const { root, entrypoint } = event.data;
        const moduleRunner = await getModuleRunner(root);
        entry = await moduleRunner.import(entrypoint);

        process.stdout.write(createChildEvent('initialized'));
      }
      case 'request': {
        const response = await entry.default();

        process.stdout.write(
          createChildEvent('response', await responseToObject(response)),
        );
      }
    }
  });
});
