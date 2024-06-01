import type { UserConfig } from 'vite';
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
    exampleFramework({
      env: process.env['vite_env'] === 'workerd' ? 'workerd' : 'node-vm',
      entrypoint:
        process.env['vite_env'] === 'workerd'
          ? './entry-workerd.ts'
          : './entry-node-vm.ts',
    }),
  ],
};

export default config;
