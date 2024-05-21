// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck

import { vitePlugin as remix } from '@remix-run/dev';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import { workerdEnvironmentProvider } from 'vite-environment-plugin-workerd';

export default defineConfig({
  plugins: [
    remix({
      ssrEnvironment: await workerdEnvironmentProvider({ config: './remix-wrangler.toml' }),
      ssrRuntime: 'workerd',
    }),
    tsconfigPaths()
  ],
});
