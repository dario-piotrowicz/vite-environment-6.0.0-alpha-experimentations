// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck

import { vitePlugin as remix } from '@remix-run/dev';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import { viteEnvironmentPluginWorkerd } from 'vite-environment-plugin-workerd';

export default defineConfig({
  plugins: [
    viteEnvironmentPluginWorkerd(),
    remix({
      runInWorkerd: true,
    }),
    tsconfigPaths(),
  ],
});
