import { ModuleRunner } from 'vite/module-runner';

type Env = {
  UNSAFE_EVAL: {
    eval: (code: string, filename?: string) => any;
  };
  __viteFetchModule: {
    fetch: (request: Request) => Promise<Response>;
  };
  root: string;
};

let entrypoint: string|undefined;

let hmrWebSocket: WebSocket|undefined;

export default {
  async fetch(req: Request, env: Env) {
    const url = new URL(req.url);

    if (req.method === 'POST' && url.pathname === '/__setEntrypoint') {
      const { entrypoint: reqEntrypoint } = await req.json<{ entrypoint: string }>();
      if(!reqEntrypoint) {
        const error = 'Error: trying to set the entrypoint without passing a value for it';
        return new Response(error, { status: 400, statusText: error });
      }
      entrypoint = reqEntrypoint;
      return new Response(null);
    }

    if (url.pathname === '/__initModuleRunner') {
      const pair = new WebSocketPair();
      (pair[0] as any).accept();
      hmrWebSocket = pair[0];
      initModuleRunner(env);
      return new Response(null, { status: 101, webSocket: pair[1] });
    }

    if(!entrypoint) {
      throw new Error(`Error: the entrypoint hasn't been initialized `);
    }

    if(!moduleRunner) {
      throw new Error(`Error: the moduleRunner hasn't been initialized`);
    }

    const entrypointModule = await moduleRunner.import(entrypoint);
    const fetch = entrypointModule.default.fetch;
    return fetch(req, env);
  },
};

let moduleRunner: ModuleRunner | undefined;

function initModuleRunner(env: Env) {
  moduleRunner = new ModuleRunner(
    {
      root: env.root,
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
            hmrWebSocket.addEventListener("message", (event) => {
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
  globalThis.__viteModuleRunner = moduleRunner;
}
