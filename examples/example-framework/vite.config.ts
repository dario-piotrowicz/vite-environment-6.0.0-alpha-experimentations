import type { UserConfig } from 'vite';
import { environmentPlugin } from './environmentPlugin';
import { exampleFramework } from './frameworkPlugin';

const config: UserConfig = {
  appType: 'custom',
  ssr: {
    target: 'webworker',
  },
  dev: {
    preTransformRequests: false,
  },
  server: {
    // TODO: without this (deprecated) setting we get an error in the terminal, investigate
    //       why that is, and also why dev.preTransformRequests doesn't work
    preTransformRequests: false,
  },
  optimizeDeps: {
    include: [],
  },
  plugins: [
    environmentPlugin(),
    exampleFramework({
      entrypoint:
        process.env['vite_env'] === 'workerd'
          ? './entry-workerd.ts'
          : './entry-node-vm.ts',
    }),
  ],
  build: {
    minify: false,
  },
};

export default config;
