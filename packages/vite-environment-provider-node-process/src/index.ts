import {
  DevEnvironment as ViteDevEnvironment,
  RemoteEnvironmentTransport,
  BuildEnvironment,
  type ResolvedConfig,
  type Plugin,
} from 'vite';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
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

  const devEnv = new ViteDevEnvironment(name, config, {
    runner: {
      transport: new RemoteEnvironmentTransport({
        send: data => {
          childProcess.stdin.write(JSON.stringify({ type: 'transport', data }));
        },
        onMessage: listener => {
          childProcess.stdout.on('data', data => {
            const parsedData = JSON.parse(data);

            if (parsedData.type === 'transport') {
              listener(parsedData.data);
            }
          });
        },
      }),
    },
    // TODO: add HMR
    hot: false,
  }) as DevEnvironment;

  let initialized = false;

  devEnv.api = {
    async getHandler({ entrypoint }) {
      if (!initialized) {
        initialized = await new Promise(resolve => {
          function initializedListener(data: any) {
            const parsedData = JSON.parse(data);

            if (parsedData.type === 'initialized') {
              childProcess.stdout.removeListener('data', initializedListener);
              resolve(true);
            }
          }

          childProcess.stdout.on('data', initializedListener);
          childProcess.stdin.write(
            JSON.stringify({
              type: 'initialize',
              data: { root: config.root, entrypoint },
            }),
          );
        });
      }

      return async (request: Request) => {
        const response = await new Promise<Response>(resolve => {
          function responseListener(data: any) {
            const parsedData = JSON.parse(data);

            if (parsedData.type === 'response') {
              childProcess.stdout.removeListener('data', responseListener);
              resolve(objectToResponse(parsedData.data));
            }
          }

          childProcess.stdout.on('data', responseListener);
          childProcess.stdin.write(JSON.stringify({ type: 'request' }));
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
