// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck

import { vitePlugin as remix } from '@remix-run/dev';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import { viteEnvironmentPluginNodeVM } from 'vite-environment-plugin-node-vm';

export default defineConfig({
  plugins: [
    viteEnvironmentPluginNodeVM(),
    remix(),
    tsconfigPaths(),
  ],
});