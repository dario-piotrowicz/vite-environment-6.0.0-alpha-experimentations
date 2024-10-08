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
        process.env['vite_env'] === 'cloudflare'
          ? 'cloudflare'
          : process.env['vite_env'] === 'node-process'
            ? 'node-process'
            : 'node-vm',
      entrypoint:
        process.env['vite_env'] === 'cloudflare'
          ? './entry-workerd.ts'
          : './entry-node.ts',
    }),
  ],
};

export default config;
