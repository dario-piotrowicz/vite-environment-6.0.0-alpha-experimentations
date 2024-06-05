import {
  DevEnvironment as ViteDevEnvironment,
  BuildEnvironment,
  type HMRChannel,
  type ResolvedConfig,
  type Plugin,
} from 'vite';

import EventEmitter from 'node:events';

import { runInContext, createContext } from 'node:vm';

export type NodeVMEnvironmentProviderOptions = {};

const runtimeName = 'node:vm';

/**
 * Metadata regarding the environment that consumers can use to get more information about the env when needed
 */
export type EnvironmentMetadata = {
  runtimeName: string;
};

export function nodeVm(
  userOptions?: NodeVMEnvironmentProviderOptions,
): typeof nodeVMEnvironment {
  const environmentPlugin = (
    environmentName: string,
    pluginConsumerOptions?: NodeVMEnvironmentProviderOptions,
  ) => {
    // we deep merge the options from the caller into the user options here, we do this so
    // that consumers of this plugin are able to override/augment/tweak the options if need be
    const pluginOptions = deepMergeOptions(userOptions, pluginConsumerOptions);
    return nodeVMEnvironment(environmentName, pluginOptions);
  };

  environmentPlugin.environmentMetadata = {};

  return environmentPlugin;
}

/**
 * Deep merged the a set of options onto another and returns the result of the operation
 * (the function does not modify the argument options themselves)
 * @param target the target/base options object
 * @param source the new options to merge into the target
 * @returns the target options object merged with the options from the source object
 */
function deepMergeOptions(
  target: NodeVMEnvironmentProviderOptions,
  source: NodeVMEnvironmentProviderOptions,
): NodeVMEnvironmentProviderOptions {
  // nothing really to do here... but this exemplifies that options would need to be merged at this point
  return {};
}

export function nodeVMEnvironment(
  environmentName: string,
  _options: NodeVMEnvironmentProviderOptions = {},
): Plugin[] {
  return [
    {
      name: 'node:vm-environment-plugin',

      async config() {
        // we could use the provided options here...

        return {
          environments: {
            [environmentName]: createNodeVmEnvironment(),
          },
        };
      },
    },
  ];
}

export function createNodeVmEnvironment() {
  return {
    metadata: { runtimeName },
    dev: {
      createEnvironment(
        name: string,
        config: ResolvedConfig,
      ): Promise<DevEnvironment> {
        return createNodeVmDevEnvironment(name, config);
      },
    },
    build: {
      createEnvironment(
        name: string,
        config: ResolvedConfig,
      ): Promise<BuildEnvironment> {
        return createNodeVmBuildEnvironment(name, config);
      },
    },
  };
}

async function createNodeVmBuildEnvironment(
  name: string,
  config: ResolvedConfig,
): Promise<BuildEnvironment> {
  const buildEnv = new BuildEnvironment(name, config);
  // Nothing too special to do here, the default build env is totally fine here
  return buildEnv;
}

async function createNodeVmDevEnvironment(
  name: string,
  config: any,
): Promise<DevEnvironment> {
  const eventEmitter = new EventEmitter();

  const hot = createSimpleHMRChannel(eventEmitter, name);

  const devEnv = new ViteDevEnvironment(name, config, { hot });

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
      async getHandler({ entrypoint }) {
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

  return devEnv as DevEnvironment;
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

export type DevEnvironment = ViteDevEnvironment & {
  // metadata: EnvironmentMetadata;
  api: {
    getHandler: ({
      entrypoint,
    }: {
      entrypoint: string;
    }) => Promise<(req: Request) => Response | Promise<Response>>;
  };
};
