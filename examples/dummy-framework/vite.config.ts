import type { UserConfig } from 'vite';
import { dummyFramework } from './frameworkPlugin';

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
    dummyFramework({
      env:
        process.env['vite_env'] === 'workerd'
          ? 'workerd'
          : process.env['vite_env'] === 'node-process'
            ? 'node-process'
            : 'node-vm',
      entrypoint:
        process.env['vite_env'] === 'workerd'
          ? './entry-workerd.ts'
          : process.env['vite_env'] === 'node-process'
            ? './entry-node-process.ts'
            : './entry-node-vm.ts',
    }),
  ],
};

export default config;
