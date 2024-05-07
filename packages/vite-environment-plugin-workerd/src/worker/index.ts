import { ModuleRunner } from 'vite/module-runner';

type Env = {
  ROOT: string;
  UNSAFE_EVAL: {
    eval: (code: string, filename?: string) => any;
  };
  __viteFetchModule: {
    fetch: (request: Request) => Promise<Response>;
  };
  root: string;
};

let entrypoint: any;
let moduleRunner: ModuleRunner;
let hmrWebSocket: WebSocket;

export default {
  async fetch(req: Request, env: Env, ctx: any) {
    const url = new URL(req.url);

    if (url.pathname === '/__init-module-runner') {
      const pair = new WebSocketPair();

      (pair[0] as any).accept();
      hmrWebSocket = pair[0];
      moduleRunner = await getModuleRunner(env);
      return new Response(null, { status: 101, webSocket: pair[1] });
    }

    if (url.pathname === '/__set-entrypoint') {
      const viteWorkerdEntrypoint = req.headers.get(
        'x-vite-workerd-entrypoint',
      );
      try {
        entrypoint = await moduleRunner.import(viteWorkerdEntrypoint!);
      } catch (error) {
        return new Response('entrypoint not set', {
          status: 500,
          statusText: `${error}`,
        });
      }
      return new Response('entrypoint successfully set');
    }

    // TODO: from env we can filter out the bindings we use to integrate with the vite environment
    return entrypoint.default(req, env, ctx);
  },
};

let _moduleRunner: ModuleRunner | undefined;

async function getModuleRunner(env: Env) {
  if (_moduleRunner) return _moduleRunner;
  _moduleRunner = new ModuleRunner(
    {
      root: env.ROOT,
      transport: {
        fetchModule: async (...args) => {
          const response = await env.__viteFetchModule.fetch(
            new Request('http://localhost', {
              method: 'POST',
              body: JSON.stringify(args),
            }),
          );
          const result = response.json();
          return result as any;
        },
      },
      hmr: {
        connection: {
          isReady: () => true,
          onUpdate(callback) {
            hmrWebSocket.addEventListener('message', event => {
              callback(JSON.parse(event.data));
            });
          },
          send(messages) {
            hmrWebSocket.send(JSON.stringify(messages));
          },
        },
      },
    },
    {
      runInlinedModule: async (context, transformed, id) => {
        const codeDefinition = `'use strict';async (${Object.keys(context).join(
          ',',
        )})=>{{`;
        const code = `${codeDefinition}${transformed}\n}}`;
        const fn = env.UNSAFE_EVAL.eval(code, id);
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
