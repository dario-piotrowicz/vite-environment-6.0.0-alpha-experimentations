import {
  ModuleRunner,
  ESModulesEvaluator,
  RemoteRunnerTransport,
} from 'vite/module-runner';
import { responseToObject } from '../utils';

async function getModuleRunner(root: string) {
  return new ModuleRunner(
    {
      root,
      transport: new RemoteRunnerTransport({
        send: data => {
          process.stdout.write(JSON.stringify({ type: 'transport', data }));
        },
        onMessage: listener => {
          process.stdin.on('data', data => {
            const parsedData = JSON.parse(data as any);

            if (parsedData.type === 'transport') {
              listener(parsedData.data);
            }
          });
        },
      }),
    },
    new ESModulesEvaluator(),
  );
}

let entry;

process.stdin.on('data', async data => {
  const parsedData = JSON.parse(data.toString());

  switch (parsedData.type) {
    case 'initialize': {
      const { root, entrypoint } = parsedData.data;
      const moduleRunner = await getModuleRunner(root);
      entry = await moduleRunner.import(entrypoint);

      process.stdout.write(JSON.stringify({ type: 'initialized' }));
    }
    case 'request': {
      const response = await entry.default();

      process.stdout.write(
        JSON.stringify({
          type: 'response',
          data: await responseToObject(response),
        }),
      );
    }
  }
});
