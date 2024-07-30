import {
  DevEnvironment as ViteDevEnvironment,
  RemoteEnvironmentTransport,
  BuildEnvironment,
  type ResolvedConfig,
  type Plugin,
} from 'vite';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import {
  processNonEvent,
  createParentEvent,
  processChildEvent,
} from './events';
import { objectToResponse } from './utils';

const runtimeName = 'node:process';

export function nodeProcessEnvironment(environmentName: string): Plugin[] {
  return [
    {
      name: 'node:process-environment-plugin',

      async config() {
        return {
          environments: {
            [environmentName]: createNodeProcessEnvironment(),
          },
        };
      },
    },
  ];
}

function createNodeProcessEnvironment() {
  return {
    metadata: { runtimeName },
    dev: {
      createEnvironment(
        name: string,
        config: ResolvedConfig,
      ): Promise<DevEnvironment> {
        return createNodeProcessDevEnvironment(name, config);
      },
    },
    build: {
      createEnvironment(
        name: string,
        config: ResolvedConfig,
      ): Promise<BuildEnvironment> {
        return createNodeProcessBuildEnvironment(name, config);
      },
    },
  };
}

async function createNodeProcessBuildEnvironment(
  name: string,
  config: ResolvedConfig,
): Promise<BuildEnvironment> {
  const buildEnv = new BuildEnvironment(name, config);

  return buildEnv;
}

async function createNodeProcessDevEnvironment(
  name: string,
  config: ResolvedConfig,
): Promise<DevEnvironment> {
  const childProcessPath = fileURLToPath(
    new URL('child-process/index.js', import.meta.url),
  );
  const childProcess = spawn('node', [childProcessPath]);

  // forward console output from child process
  childProcess.stdout.on('data', data => {
    processNonEvent(data, input => console.log(input));
  });

  const devEnv = new ViteDevEnvironment(name, config, {
    runner: {
      transport: new RemoteEnvironmentTransport({
        send: data => {
          childProcess.stdin.write(createParentEvent('transport', data));
        },
        onMessage: listener => {
          childProcess.stdout.on('data', data => {
            processChildEvent(data, event => {
              if (event.type === 'transport') {
                listener(event.data);
              }
            });
          });
        },
      }),
    },
    hot: {
      send: data => {
        childProcess.stdin.write(createParentEvent('hmr', data));
      },
      on: () => {},
      off: () => {},
      listen: () => {},
      close: () => {},
    },
  }) as DevEnvironment;

  let initialized = false;

  devEnv.api = {
    async getHandler({ entrypoint }) {
      if (!initialized) {
        initialized = await new Promise(resolve => {
          function initializedListener(data: any) {
            processChildEvent(data, event => {
              if (event.type === 'initialized') {
                childProcess.stdout.removeListener('data', initializedListener);
                resolve(true);
              }
            });
          }

          childProcess.stdout.on('data', initializedListener);
          childProcess.stdin.write(
            createParentEvent('initialize', { root: config.root, entrypoint }),
          );
        });
      }

      return async (request: Request) => {
        const response = await new Promise<Response>(resolve => {
          function responseListener(data: any) {
            processChildEvent(data, event => {
              if (event.type === 'response') {
                childProcess.stdout.removeListener('data', responseListener);
                resolve(objectToResponse(event.data));
              }
            });
          }

          childProcess.stdout.on('data', responseListener);
          childProcess.stdin.write(createParentEvent('request'));
        });

        return response;
      };
    },
  };

  return devEnv;
}

type EnvironmentMetadata = {
  runtimeName: string;
};

type DevEnvironment = ViteDevEnvironment & {
  metadata: EnvironmentMetadata;
  api: {
    getHandler: ({
      entrypoint,
    }: {
      entrypoint: string;
    }) => Promise<(req: Request) => Response | Promise<Response>>;
  };
};
