import type { HMRChannel, DevEnvironment, ResolvedConfig } from 'vite';
import {
  MessageEvent,
  Miniflare,
  Response as MiniflareResponse,
  TypedEventListener,
} from 'miniflare';
import { fileURLToPath } from 'node:url';

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

let workerdEnv: DevEnvironment|null = null;

export async function createWorkerdDevEnvironment(
  name: string,
  config: ResolvedConfig,
): Promise<DevEnvironment> {
  if(workerdEnv) {
    return workerdEnv;
  }

  const mf = new Miniflare({
    modulesRoot: '/',
    modules: [
      {
        type: 'ESModule',
        path: fileURLToPath(new URL('./worker/index.js', import.meta.url)),
      },
    ],
    unsafeEvalBinding: 'UNSAFE_EVAL',
    compatibilityDate: '2024-02-08',
    compatibilityFlags: ['nodejs_compat'],
    kvNamespaces: [
      // TODO: we should read this from the toml file and not hardcode it
      'MY_KV_NAMESPACE',
      'MY_KV'
    ],
    bindings: {
      root: config.root,
    },
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

  const resp = await mf.dispatchFetch('http:0.0.0.0/__initModuleRunner', {
    headers: {
      upgrade: 'websocket',
    },
  });
  if (!resp.ok) {
    throw new Error('Error: failed to initialize the module runner! ');
  }
  const webSocket = resp.webSocket;
  webSocket.accept();

  const hotEventListenersMap = new Map<string, Set<Function>>();
  let hotDispose: (() => void) | undefined;

  const hot: HMRChannel = {
    name,
    listen() {
      const listener: TypedEventListener<MessageEvent> = data => {
        const payload = JSON.parse(data as unknown as string);
        for (const f of hotEventListenersMap.get(payload.event)) {
          f(payload.data);
        }
      };

      webSocket.addEventListener('message', listener);
      hotDispose = () => {
        webSocket.removeEventListener('message', listener);
      };
    },
    close() {
      hotDispose?.();
      hotDispose = undefined;
    },
    on(event: string, listener: (...args: any[]) => any) {
      if (!hotEventListenersMap.get(event)) {
        hotEventListenersMap.set(event, new Set());
      }
      hotEventListenersMap.get(event).add(listener);
    },
    off(event: string, listener: (...args: any[]) => any) {
      hotEventListenersMap.get(event).delete(listener);
    },
    send(...args: any[]) {
      let payload: any;
      if (typeof args[0] === 'string') {
        payload = {
          type: 'custom',
          event: args[0],
          data: args[1],
        };
      } else {
        payload = args[0];
      }
      webSocket.send(JSON.stringify(payload));
    },
  };

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

  const devEnv = new WorkerdDevEnvironmentImpl(name, config, { hot });

  (devEnv as WorkerdDevEnvironment).api = {
    createRequestDispatcher: getCreateRequestDispatcher(),
  };

  function getCreateRequestDispatcher() {
    const createRequestDispatcher: CreateRequestDispatcher = async ({
      entrypoint,
    }) => {
      // module is used to collect the cjs exports from the module evaluation
      const dispatchRequestImplementation =
        await getClientDispatchRequest(entrypoint);

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
    entrypoint: string,
  ): Promise<DispatchRequest> {
    const resp = await mf.dispatchFetch('http:0.0.0.0/__setEntrypoint', {
      method: 'POST',
      body: JSON.stringify({
        entrypoint,
      }),
    });
    if (!resp.ok) {
      throw new Error('Error: failed to set the entrypoint!');
    }

    return (req: Request) => {
      return mf.dispatchFetch(`${req.url}`);
    };
  }

  workerdEnv = devEnv;
  return devEnv;
}
