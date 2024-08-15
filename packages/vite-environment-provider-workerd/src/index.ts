import {
  DevEnvironment as ViteDevEnvironment,
  BuildEnvironment,
  type HotChannel,
  type HotPayload,
  type ResolvedConfig,
  type Plugin,
  HotUpdateContext,
} from 'vite';

import {
  SourcelessWorkerOptions,
  unstable_getMiniflareWorkerOptions,
} from 'wrangler';

import {
  Miniflare,
  Response as MiniflareResponse,
  type MessageEvent,
  type WebSocket,
} from 'miniflare';

import { fileURLToPath } from 'node:url';
import { dirname, relative, resolve } from 'node:path';
import { readFile } from 'fs/promises';
import * as debugDumps from './debug-dumps';
import { collectModuleInfo } from './moduleUtils';

export type DevEnvironment = ViteDevEnvironment & {
  metadata: EnvironmentMetadata;
  api: {
    getHandler: ({
      entrypoint,
    }: {
      entrypoint: string;
    }) => Promise<(req: Request) => Response | Promise<Response>>;
  };
};

export type WorkerdEnvironmentOptions = {
  config?: string;
};

const runtimeName = 'workerd';

/**
 * Metadata regarding the environment that consumers can use to get more information about the env when needed
 */
export type EnvironmentMetadata = {
  runtimeName: string;
};

export function workerd(
  userOptions: WorkerdEnvironmentOptions,
): typeof workerdEnvironment {
  return (
    environmentName: string,
    pluginConsumerOptions: WorkerdEnvironmentOptions,
  ) => {
    // we deep merge the options from the caller into the user options here, we do this so
    // that consumers of this plugin are able to override/augment/tweak the options if need be
    const pluginOptions = deepMergeOptions(userOptions, pluginConsumerOptions);
    return workerdEnvironment(environmentName, pluginOptions);
  };
}

/**
 * Deep merged the a set of options onto another and returns the result of the operation
 * (the function does not modify the argument options themselves)
 * @param target the target/base options object
 * @param source the new options to merge into the target
 * @returns the target options object merged with the options from the source object
 */
function deepMergeOptions(
  target: WorkerdEnvironmentOptions,
  source: WorkerdEnvironmentOptions,
): WorkerdEnvironmentOptions {
  // the "deep merging" right now is very trivial... with a realistic/more complex
  // options structure we'd have to do a real deep merge here
  return {
    config: target.config ?? source.config,
  };
}

const defaultWranglerConfig = 'wrangler.toml';

export function workerdEnvironment(
  environmentName: string,
  options: WorkerdEnvironmentOptions = {},
): Plugin[] {
  const resolvedWranglerConfigPath = resolve(
    options.config ?? defaultWranglerConfig,
  );
  options.config = resolvedWranglerConfigPath;

  return [
    {
      name: 'workerd-environment-plugin',

      async config() {
        return {
          environments: {
            [environmentName]: createWorkerdEnvironment(options),
          },
        };
      },
      hotUpdate(ctx: HotUpdateContext) {
        if (ctx.environment.name !== environmentName) {
          return;
        }
        if (ctx.file === resolvedWranglerConfigPath) {
          ctx.server.restart();
        }
      },
    },
  ];
}

export function createWorkerdEnvironment(options: WorkerdEnvironmentOptions) {
  return {
    metadata: { runtimeName },
    dev: {
      createEnvironment(
        name: string,
        config: ResolvedConfig,
      ): Promise<DevEnvironment> {
        return createWorkerdDevEnvironment(name, config, options);
      },
    },
    build: {
      createEnvironment(
        name: string,
        config: ResolvedConfig,
      ): Promise<BuildEnvironment> {
        return createWorkerdBuildEnvironment(name, config, options);
      },
    },
  };
}

async function createWorkerdBuildEnvironment(
  name: string,
  config: ResolvedConfig,
  _workerdOptions: WorkerdEnvironmentOptions,
): Promise<BuildEnvironment> {
  const buildEnv = new BuildEnvironment(name, config);
  // Nothing too special to do here, the default build env is probably ok for now
  return buildEnv;
}

async function createWorkerdDevEnvironment(
  name: string,
  config: ResolvedConfig,
  workerdOptions: WorkerdEnvironmentOptions,
): Promise<DevEnvironment> {
  const { bindings: bindingsFromToml, ...optionsFromToml } =
    getOptionsFromWranglerConfig(workerdOptions.config!);

  const mf = new Miniflare({
    modulesRoot: fileURLToPath(new URL('./', import.meta.url)),
    modules: [
      {
        type: 'ESModule',
        path: fileURLToPath(new URL('worker/index.js', import.meta.url)),
      },
      {
        // we declare the workerd-custom-import as a CommonJS module, thanks to this
        // require is made available in the module and we are able to handle cjs imports, etc...
        type: 'CommonJS',
        path: fileURLToPath(
          new URL('workerd-custom-import.cjs', import.meta.url),
        ),
      },
    ],
    unsafeEvalBinding: 'UNSAFE_EVAL',
    bindings: {
      ...bindingsFromToml,
      ROOT: config.root,
    },
    serviceBindings: {
      __viteFetchModule: async request => {
        const args = await request.json();
        try {
          const result: any = await devEnv.fetchModule(...(args as [any, any]));
          await debugDumps.dump__viteFetchModuleLog(args, result);
          return new MiniflareResponse(JSON.stringify(result));
        } catch (error) {
          console.error('[fetchModule]', args, error);
          throw error;
        }
      },
      __debugDump: debugDumps.__debugDumpBinding,
    },
    unsafeUseModuleFallbackService: true,
    async unsafeModuleFallbackService(request) {
      const resolveMethod = request.headers.get('X-Resolve-Method');
      if (resolveMethod !== 'import' && resolveMethod !== 'require') {
        throw new Error('unrecognized resolvedMethod');
      }

      const url = new URL(request.url);
      const specifier = url.searchParams.get('specifier');
      if (!specifier) {
        throw new Error('no specifier provided');
      }

      const rawSpecifier = url.searchParams.get('rawSpecifier');

      const referrer = url.searchParams.get('referrer');

      const referrerDir = dirname(referrer);

      let fixedSpecifier = specifier;

      if (!/node_modules/.test(referrerDir)) {
        // for app source code strip prefix and prepend /
        fixedSpecifier = '/' + getApproximateSpecifier(specifier, referrerDir);
      } else if (!specifier.endsWith('.js')) {
        // for package imports from other packages strip prefix
        fixedSpecifier = getApproximateSpecifier(specifier, referrerDir);
      }

      fixedSpecifier = rawSpecifier;

      try {
        let { id } = await devEnv.pluginContainer.resolveId(
          fixedSpecifier,
          referrer,
          {
            // The following is to let know `resolveId` if the import is actually a require
            // https://github.com/vitejs/vite/blob/8851d9d1c97cdce0807edd45e33e70446e545956/packages/vite/src/node/plugins/resolve.ts#L228-L230
            // (Note: I am not sure if this is actually making any difference ¯\_(ツ)_/¯)
            custom: {
              'node-resolve': { isRequire: resolveMethod === 'require' },
            },
          },
        );

        const resolvedId = id;

        if (id.includes('?')) id = id.slice(0, id.lastIndexOf('?'));

        const redirectTo =
          id !== rawSpecifier && id !== specifier ? id : undefined;

        if (redirectTo) {
          return new MiniflareResponse(null, {
            headers: { location: id },
            status: 301,
          });
        }

        // and we read the code from the resolved file
        const code: string | null = await readFile(id, 'utf8').catch(
          () => null,
        );

        const notFound = !code;

        const moduleInfo = await collectModuleInfo(code, id);

        debugDumps.dumpModuleFallbackServiceLog({
          resolveMethod,
          referrer,
          specifier,
          rawSpecifier,
          fixedSpecifier,
          resolvedId,
          redirectTo,
          code,
          isCommonJS: moduleInfo.isCommonJS,
          notFound: notFound || undefined,
        });

        if (notFound) {
          return new MiniflareResponse(null, { status: 404 });
        }

        const mod = moduleInfo.isCommonJS
          ? {
              commonJsModule: code,
              namedExports: moduleInfo.namedExports,
            }
          : {
              esModule: code,
            };

        return new MiniflareResponse(
          JSON.stringify({
            name: specifier.replace(/^\//, ''),
            ...mod,
          }),
        );
      } catch {}
    },
    ...optionsFromToml,
  });

  const resp = await mf.dispatchFetch('http:0.0.0.0/__init-module-runner', {
    headers: {
      upgrade: 'websocket',
    },
  });
  if (!resp.ok) {
    throw new Error('Error: failed to initialize the module runner!');
  }

  const webSocket = resp.webSocket;

  if (!webSocket) {
    console.error(
      '\x1b[33m⚠️ failed to create a websocket for HMR (hmr disabled)\x1b[0m',
    );
  }

  const hot = webSocket ? createHotChannel(webSocket!) : false;

  const devEnv = new ViteDevEnvironment(name, config, {
    hot,
  }) as DevEnvironment;

  let entrypointSet = false;
  devEnv.api = {
    async getHandler({ entrypoint }) {
      if (!entrypointSet) {
        const resp = await mf.dispatchFetch('http:0.0.0.0/__set-entrypoint', {
          headers: [['x-vite-workerd-entrypoint', entrypoint]],
        });
        if (resp.ok) {
          entrypointSet = resp.ok;
        } else {
          throw new Error(
            'failed to set entrypoint (the error should be logged in the terminal)',
          );
        }
      }

      return async (req: Request) => {
        // TODO: ideally we should pass the request itself with close to no tweaks needed... this needs to be investigated
        return await mf.dispatchFetch(req.url, {
          method: req.method,
          body: req.body,
          duplex: 'half',
          headers: [
            // note: we disable encoding since this causes issues when the miniflare response
            //       gets piped into the node one
            ['accept-encoding', 'identity'],
            ...req.headers,
          ],
        });
      };
    },
  };

  return devEnv;
}
function createHotChannel(webSocket: WebSocket): HotChannel {
  webSocket.accept();

  const listenersMap = new Map<string, Set<Function>>();
  let hotDispose: () => void;

  return {
    send(...args) {
      let payload: HotPayload;

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
    on(event, listener) {
      if (!listenersMap.get(event)) {
        listenersMap.set(event, new Set());
      }

      listenersMap.get(event).add(listener);
    },
    off(event, listener) {
      listenersMap.get(event)?.delete(listener);
    },
    listen() {
      function eventListener(event: MessageEvent) {
        const payload = JSON.parse(event.data.toString());

        if (!listenersMap.get(payload.event)) {
          listenersMap.set(payload.event, new Set());
        }

        for (const fn of listenersMap.get(payload.event)) {
          fn(payload.data);
        }
      }

      webSocket.addEventListener('message', eventListener);

      hotDispose = () => {
        webSocket.removeEventListener('message', eventListener);
      };
    },
    close() {
      hotDispose?.();
      hotDispose = undefined;
    },
  };
}

function getOptionsFromWranglerConfig(configPath: string) {
  let configOptions: SourcelessWorkerOptions;
  try {
    const { workerOptions } = unstable_getMiniflareWorkerOptions(configPath);
    configOptions = workerOptions;
  } catch (e) {
    console.warn(`WARNING: unable to read config file at "${configPath}"`);
    return {};
  }

  const {
    bindings,
    textBlobBindings,
    dataBlobBindings,
    wasmBindings,
    kvNamespaces,
    r2Buckets,
    d1Databases,
    compatibilityDate,
    compatibilityFlags,
  } = configOptions;

  return {
    bindings,
    textBlobBindings,
    dataBlobBindings,
    wasmBindings,
    kvNamespaces,
    r2Buckets,
    d1Databases,
    compatibilityDate,
    compatibilityFlags,
  };
}

function getApproximateSpecifier(target: string, referrerDir: string): string {
  let result = '';
  if (/^(node|cloudflare|workerd):/.test(target)) result = target;
  result = relative(referrerDir, target);
  return result;
}
