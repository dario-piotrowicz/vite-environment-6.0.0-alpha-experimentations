import {
  DevEnvironment as ViteDevEnvironment,
  BuildEnvironment,
  type HMRChannel,
  type ResolvedConfig,
} from 'vite';

import {
  Miniflare,
  Response as MiniflareResponse,
  type MessageEvent,
  type TypedEventListener,
  type WebSocket,
} from 'miniflare';

import { fileURLToPath } from 'node:url';
import { dirname, relative } from 'node:path';
import { readFile } from 'fs/promises';
import * as debugDumps from './debug-dumps';

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

export type WorkerdEnvironmentProviderOptions = {
  config?: string;
};

const runtimeName = 'workerd';

/**
 * Metadata regarding the environment that consumers can use to get more information about the env when needed
 */
export type EnvironmentMetadata = {
  runtimeName: string;
};

export type ViteEnvironmentProvider =
  // Note: ViteEnvironmentProvider needs to return `createEnvironment`s for both `dev` and `build`!
  //       if a plugin then doesn't need both (e.g. they want the build to be done on a different environment)
  //       they can just pick from/tweak the ViteEnvironmentProvider by themselves
  {
    metadata: EnvironmentMetadata;
    dev: {
      createEnvironment(
        name: string,
        config: ResolvedConfig,
      ): Promise<DevEnvironment>;
    };
    build: {
      createEnvironment(
        name: string,
        config: ResolvedConfig,
      ): Promise<BuildEnvironment>;
    };
  };

export async function workerdEnvironmentProvider(
  options: WorkerdEnvironmentProviderOptions = {},
): Promise<ViteEnvironmentProvider> {
  // we're not really reading the configuration, the following console.log
  // just exemplifies such workflow
  console.log(
    `(pretend that we're...) reading configuration from ${options.config}...`,
  );

  return {
    metadata: { runtimeName },
    dev: {
      createEnvironment(
        name: string,
        config: ResolvedConfig,
      ): Promise<DevEnvironment> {
        return createWorkerdDevEnvironment(name, config);
      },
    },
    build: {
      createEnvironment(
        name: string,
        config: ResolvedConfig,
      ): Promise<BuildEnvironment> {
        return createWorkerdBuildEnvironment(name, config);
      },
    },
  };
}

async function createWorkerdBuildEnvironment(
  name: string,
  config: ResolvedConfig,
): Promise<BuildEnvironment> {
  const buildEnv = new BuildEnvironment(name, config);
  // Nothing too special to do here, the default build env is probably ok for now
  return buildEnv;
}

async function createWorkerdDevEnvironment(
  name: string,
  config: ResolvedConfig,
): Promise<DevEnvironment> {
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
        path: fileURLToPath(new URL('workerd-custom-import.cjs', import.meta.url)),
      },
    ],
    unsafeEvalBinding: 'UNSAFE_EVAL',
    compatibilityDate: '2024-02-08',
    compatibilityFlags: ['nodejs_compat'],
    // TODO: we should read this from a toml file and not hardcode it
    kvNamespaces: ['MY_KV'],
    bindings: {
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

      const rawSpecifier = url.searchParams.get('raw'); // 👈 it should be rawSpecifier

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

      let result: { code: string } | undefined;
      try {
        // we make the pluginContainer resolve the files correctly
        let { id } = await devEnv.pluginContainer.resolveId(
          fixedSpecifier,
          referrer,
          {
            // https://github.com/vitejs/vite/blob/v5.1.4/packages/vite/src/node/plugins/resolve.ts#L178-L179
            // custom: { "node-resolve": { isRequire: true } },
          }
        );

        const resolvedId = id;

        if (id.includes('?')) id = id.slice(0, id.lastIndexOf('?'));

        const redirectTo = id !== rawSpecifier && id !== specifier ? id : undefined;

        let code: string|undefined;
        if(!redirectTo) {
          // and we read the code from the resolved file
          code = await readFile(id, 'utf8');
          if (code) {
            result = { code };
          }
        }

        if(redirectTo) {
          return new MiniflareResponse(null, {headers: {location: id}, status: 301});
        }

        const notFound = !result;

      // TODO: to implement properly
      const isCommonJS = code &&
        (code.includes('module.exports =') ||
        code.includes('\nexports.') ||
        code.includes('\nexports['));

      // if result is commonjs
      const mod = isCommonJS
        ? {
            commonJsModule: result.code,
          }
        : {
            esModule: result.code,
          };

          debugDumps.dumpModuleFallbackServiceLog({
            resolveMethod,
            referrer,
            specifier,
            rawSpecifier,
            fixedSpecifier,
            resolvedId,
            redirectTo,
            code,
            isCommonJS,
            notFound: notFound || undefined,
          })

        if (notFound) {
          return new MiniflareResponse(null, { status: 404 });
        }

      return new MiniflareResponse(
        JSON.stringify({
          name: specifier.replace(/^\//, ''),
          ...mod,
        }),
      );
      } catch {}
    },
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

  const hot = webSocket ? createHMRChannel(webSocket!, name) : false;

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
function createHMRChannel(webSocket: WebSocket, name: string): HMRChannel {
  webSocket.accept();

  const hotEventListenersMap = new Map<
    string,
    Set<(...args: any[]) => unknown>
  >();
  let hotDispose: (() => void) | undefined;

  return {
    name,
    listen() {
      const listener: TypedEventListener<MessageEvent> = data => {
        const payload = JSON.parse(data as unknown as string);
        for (const f of hotEventListenersMap.get(payload.event)!) {
          f(payload.data);
        }
      };

      webSocket.addEventListener('message', listener as any);
      hotDispose = () => {
        webSocket.removeEventListener('message', listener as any);
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
      webSocket.send(JSON.stringify(payload));
    },
  };
}

function getApproximateSpecifier(target: string, referrerDir: string): string {
  let result = '';
  if (/^(node|cloudflare|workerd):/.test(target)) result = target;
  result = relative(referrerDir, target);
  return result;
}
