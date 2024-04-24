import { type DevEnvironment, type ResolvedConfig } from 'vite';

export function viteEnvironmentPluginWorkerd() {
  return {
    name: 'vite-environment-plugin-workerd',

    async config() {
      return {
        environments: {
          workerd: {
            dev: {
              createEnvironment(name: string, config: ResolvedConfig): Promise<DevEnvironment> {
                return createWorkerdDevEnvironment(name, config);
              }
            },
          },
        },
      };
    },
  };
};

export type CreateRequestDispatcher = (
  options: CreateRequestDispatcherOptions,
) => Promise<DispatchRequest>;

export type CreateRequestDispatcherOptions = {
  entrypoint: string;
};

export type DispatchRequest = (req: Request) => Response | Promise<Response>;

export type WorkerdDevEnvironment = DevEnvironment & {
  api: {
    createRequestDispatcher: CreateRequestDispatcher;
  }
};

export async function createWorkerdDevEnvironment(
  name: string,
  config: ResolvedConfig,
): Promise<DevEnvironment> {

  // TODO
  // const miniflare = new Miniflare({
  //   // ...
  // });

  // TODO: having `import { DevEnvironment } from "vite";` at the top of this file
  //       results in DevEnvironment being undefined... I'm not sure why, that should be investigated 
  const DevEnvironment = await import('vite').then(({ DevEnvironment }) => DevEnvironment)!;

  class WorkerdDevEnvironmentImpl extends DevEnvironment {
    override async close() {
      await super.close();
      // await miniflare.dispose();
    }
  }

  const devEnv = new WorkerdDevEnvironmentImpl(name, config, { /*hot*/ }); // <-- TODO: add hot

  (devEnv as WorkerdDevEnvironment).api = {
    async createRequestDispatcher({ entrypoint }: CreateRequestDispatcherOptions) {
      return (req) => {
        return new Response(`TODO: server result from Miniflare (user entrypoint=${entrypoint})`);
      }
    }
  }

  return devEnv;
}