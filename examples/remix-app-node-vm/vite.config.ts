// @ts-ignore - my remix-run/dev forked package doesn't seem to provide types correctly, not a real issue here
import { vitePlugin as remix } from '@remix-run/dev';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import { nodeVm } from '@flarelabs-net/vite-environment-provider-node-vm';

export default defineConfig({
  plugins: [
    // @ts-ignore
    remix({
      // @ts-ignore
      ssrEnvironment: nodeVm(),
    }),
    tsconfigPaths(),
  ],
});
