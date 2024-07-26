import {
  DevEnvironment as ViteDevEnvironment,
  BuildEnvironment,
  type HMRChannel,
  type ResolvedConfig,
  type Plugin,
} from 'vite';

// TEMP
import { ModuleRunner, ESModulesEvaluator } from 'vite/module-runner';

const runtimeName = 'node:process';

export function nodeProcessEnvironment(environmentName: string): Plugin[] {
  return [
    {
      name: 'node:process-environment-plugin',

      async config() {
        return {
          environments: {
            [environmentName]: createNodeProcessEnvironment(),
          },
        };
      },
    },
  ];
}

function createNodeProcessEnvironment() {
  return {
    metadata: { runtimeName },
    dev: {
      createEnvironment(
        name: string,
        config: ResolvedConfig,
      ): Promise<DevEnvironment> {
        return createNodeProcessDevEnvironment(name, config);
      },
    },
    build: {
      createEnvironment(
        name: string,
        config: ResolvedConfig,
      ): Promise<BuildEnvironment> {
        return createNodeProcessBuildEnvironment(name, config);
      },
    },
  };
}

async function createNodeProcessDevEnvironment(
  name: string,
  config: ResolvedConfig,
): Promise<DevEnvironment> {
  // TODO: add HMR
  const devEnv = new ViteDevEnvironment(name, config) as DevEnvironment;

  devEnv.api = {
    async getHandler({ entrypoint }) {
      async function getModuleRunner() {
        const _moduleRunner = new ModuleRunner(
          {
            root: config.root,
            transport: {
              fetchModule: async (...args) => devEnv.fetchModule(...args),
            },
          },
          new ESModulesEvaluator(),
        );

        return _moduleRunner;
      }

      const moduleRunner = await getModuleRunner();
      const entry = await moduleRunner.import(entrypoint);

      return entry.default;
    },
  };

  return devEnv;
}

async function createNodeProcessBuildEnvironment(
  name: string,
  config: ResolvedConfig,
): Promise<BuildEnvironment> {
  const buildEnv = new BuildEnvironment(name, config);

  return buildEnv;
}

type EnvironmentMetadata = {
  runtimeName: string;
};

type DevEnvironment = ViteDevEnvironment & {
  metadata: EnvironmentMetadata;
  api: {
    getHandler: ({
      entrypoint,
    }: {
      entrypoint: string;
    }) => Promise<(req: Request) => Response | Promise<Response>>;
  };
};
