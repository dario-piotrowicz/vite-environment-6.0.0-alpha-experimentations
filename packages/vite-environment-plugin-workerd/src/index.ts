import { readFile } from 'fs/promises';
import { resolve } from 'node:path';
import { type DevEnvironment, type ResolvedConfig } from 'vite';
import { Miniflare, Response as MiniflareResponse } from 'miniflare';

export function viteEnvironmentPluginWorkerd() {
  return {
    name: 'vite-environment-plugin-workerd',

    async config() {
      return {
        environments: {
          workerd: {
            dev: {
              createEnvironment(
                name: string,
                config: ResolvedConfig,
              ): Promise<DevEnvironment> {
                return createWorkerdDevEnvironment(name, config);
              },
            },
          },
        },
      };
    },
  };
}

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
  };
};

export async function createWorkerdDevEnvironment(
  name: string,
  config: ResolvedConfig,
): Promise<DevEnvironment> {
  let mf: Miniflare|undefined;

  // TODO: having `import { DevEnvironment } from "vite";` at the top of this file
  //       results in DevEnvironment being undefined... I'm not sure why, that should be investigated
  const DevEnvironment = await import('vite').then(
    ({ DevEnvironment }) => DevEnvironment,
  )!;

  class WorkerdDevEnvironmentImpl extends DevEnvironment {
    override async close() {
      await super.close();
      await mf?.dispose();
    }
  }

  const devEnv = new WorkerdDevEnvironmentImpl(name, config, {
    /*hot*/
  }); // <-- TODO: add hot

  (devEnv as WorkerdDevEnvironment).api = {
    createRequestDispatcher: getCreateRequestDispatcher(config),
  };

  function getCreateRequestDispatcher(config: ResolvedConfig) {
    const createRequestDispatcher: CreateRequestDispatcher = async ({
      entrypoint,
    }) => {
      // module is used to collect the cjs exports from the module evaluation
      const dispatchRequestImplementation = await getClientDispatchRequest(
        config.root,
        entrypoint,
      );

      const dispatchRequest: DispatchRequest = async request => {
        return dispatchRequestImplementation(request);
      };
      return dispatchRequest;
    };

    return createRequestDispatcher;
  }

  /**
   * Gets the `dispatchRequest` from the client (e.g. from the js running inside the workerd)
   */
  async function getClientDispatchRequest(
    serverRoot: string,
    entrypoint: string,
    // fetchModuleUrl: string,
  ): Promise<DispatchRequest> {
    const script = await getClientScript(serverRoot, entrypoint);

    mf ??= new Miniflare({
      script,
      modules: true,
      unsafeEvalBinding: 'UNSAFE_EVAL',
      compatibilityDate: '2024-02-08',
      kvNamespaces: [
        // TODO: we should read this from the toml file and not hardcode it
        'MY_KV_NAMESPACE',
      ],
      serviceBindings: {
        __viteFetchModule: async request => {
          const args = await request.json();
          try {
            const result = await devEnv.fetchModule(...(args as [any, any]));
            return new MiniflareResponse(JSON.stringify(result));
          } catch (error) {
            console.error('[fetchModule]', args, error);
            throw error;
          }
        },
      },
    });

    return (req: Request) => {
      return mf.dispatchFetch(`http://any.local${req.url}`);
    };
  }

  /**
   * gets the client script to be run in the vm, it also applies
   * the various required string replacements
   */
  async function getClientScript(serverRoot: string, entrypoint: string) {
    const workerPath = resolve(__dirname, './worker/index.js');
    const workerContent = await readFile(workerPath, 'utf-8');

    return workerContent
      .replace(/__ROOT__/g, JSON.stringify(serverRoot))
      .replace(/__ENTRYPOINT__/g, JSON.stringify(entrypoint));
    // TODO 👇
    // .replace(/__VITE_HMR_URL__/g, JSON.stringify(getHmrUrl(server)));
  }

  return devEnv;
}
