import { DevEnvironment, type HMRChannel, type ResolvedConfig } from 'vite';

import EventEmitter from 'node:events';

import { runInContext, createContext } from 'node:vm';

export function viteEnvironmentPluginNodeVM() {
  return {
    name: 'vite-environment-plugin-node-vm',

    async config() {
      return {
        environments: {
          'node-vm': {
            dev: {
              createEnvironment(
                name: string,
                config: ResolvedConfig,
              ): Promise<DevEnvironment> {
                return createNodeVmDevEnvironment(name, config);
              },
            },
          },
        },
      };
    },
  };
}

async function createNodeVmDevEnvironment(
  name: string,
  config: any,
): Promise<DevEnvironment> {
  const eventEmitter = new EventEmitter();

  const hot = createSimpleHMRChannel(eventEmitter, name);

  const devEnv = new DevEnvironment(name, config, { hot });

  const vmContext = createContext({
    config,
    console: {
      ...console,
      log: (...args: any[]) => {
        console.log('\nlog from node VM ========');
        console.log(...args);
        console.log('=========================\n');
      },
    },
    devEnv,
    Request,
    setTimeout,
    Response,
    URL,
    Headers,
    eventEmitter,
  });

  const script = `
    let _moduleRunner;
    async function getModuleRunner() {
      if (_moduleRunner) return _moduleRunner;
      const { ModuleRunner } = await import("vite/module-runner");
      _moduleRunner = new ModuleRunner(
          {
            root: config.root,
            transport: {
              fetchModule: async (...args) => devEnv.fetchModule(...args),
            },
            hmr: {
              connection: {
                isReady: () => true,
                onUpdate(callback) {
                  eventEmitter.on("message", (event) => {
                    callback(JSON.parse(event));
                  });
                },
                send(message) {
                  eventEmitter.emit("message",JSON.stringify(message));
                },
              },
            },
          },
          {
            runInlinedModule: async (context, transformed, id) => {
              const codeDefinition = \`'use strict';async (\${Object.keys(context).join(
                ',',
              )})=>{{\`;
              const code = \`\${codeDefinition}\${transformed}\n}}\`;
              const fn = eval(code, id);
              await fn(...Object.values(context));
              Object.freeze(context.__vite_ssr_exports__);
            },
            async runExternalModule(filepath) {
              return import(filepath);
            },
          },
      );
      return _moduleRunner;
    }

    devEnv.api = {
      async getNodeHandler({ entrypoint }) {
        const moduleRunner = await getModuleRunner();
        const entry = await moduleRunner.import(entrypoint);
        return entry.default;
      }
    }
  `;

  runInContext(script, vmContext, {
    // hack to get dynamic imports to work in node vms
    importModuleDynamically: specifier => {
      return import(specifier) as any;
    },
  });

  return devEnv;
}

function createSimpleHMRChannel(
  eventEmitter: EventEmitter,
  name: string,
): HMRChannel {
  let hotDispose: (() => void) | undefined;

  const hotEventListenersMap = new Map<
    string,
    Set<(...args: any[]) => unknown>
  >();

  return {
    name,
    listen() {
      const listener = (data: any) => {
        const payload = JSON.parse(data as unknown as string);
        for (const f of hotEventListenersMap.get(payload.event)!) {
          f(payload.data);
        }
      };

      eventEmitter.on('message', listener as any);
      hotDispose = () => {
        eventEmitter.off('message', listener as any);
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
      hotEventListenersMap.get(event)!.add(listener);
    },
    off(event: string, listener: (...args: any[]) => any) {
      hotEventListenersMap.get(event)!.delete(listener);
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
      eventEmitter.emit('message', JSON.stringify(payload));
    },
  };
}

type NodeVMHandler = (req: Request) => Response | Promise<Response>;

export type NodeVMDevEnvironment = DevEnvironment & {
  api: {
    getNodeHandler: ({
      entrypoint,
    }: {
      entrypoint: string;
    }) => Promise<NodeVMHandler>;
  };
};
