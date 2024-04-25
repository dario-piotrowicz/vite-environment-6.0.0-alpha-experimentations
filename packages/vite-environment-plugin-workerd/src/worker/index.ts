import { ModuleRunner } from 'vite/module-runner';

declare const __ROOT__: string;
declare const __ENTRYPOINT__: string;

type Env = {
  UNSAFE_EVAL: {
    eval: (code: string, filename?: string) => any;
  };
  __viteFetchModule: {
    fetch: (request: Request) => Promise<Response>;
  };
};

let unsafeEval: {
  eval: (code: string, ...args: any[]) => any;
};

export default {
  async fetch(req: Request, env: any) {
    unsafeEval = env.UNSAFE_EVAL;

    const moduleRunner = getModuleRunner(env);
    const entrypointModule = await moduleRunner.import(__ENTRYPOINT__);
    const fetch = entrypointModule.default.fetch;

    return fetch(req, env);
  },
};

let moduleRunner: ModuleRunner | undefined;

function getModuleRunner(env: Env): ModuleRunner {
  if (moduleRunner) {
    return moduleRunner;
  }
  return (moduleRunner = new ModuleRunner(
    {
      root: __ROOT__,
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
      hmr: false, // TODO
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
        throw new Error(`runExternalModule: ${filepath}`);
      },
    },
  ));
}
