// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck

import { vitePlugin as remix } from '@remix-run/dev';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import { viteEnvironmentPluginWorkerd } from 'vite-environment-plugin-workerd';

export default defineConfig({
  plugins: [viteEnvironmentPluginWorkerd(), remix(), tsconfigPaths()],
});

// 📋 TODO:
//   Change the above config 👆 so that the remix plugin takes a provider for the ssrEnvironment, something like
//   `workerdEnvironmentProvider.`
//   Such `workerdEnvironmentProvider` should take some options and it should not the environment itself but a
//   factory function that can be used by Vite to create the environment.
//   Also `workerdEnvironmentProvider` should enable the remix plugin to use such the workerd environment
//   for dev and build.
//
//   For example this is how the config.plugins field could look like:
//   ```
//   plugins: [
//     remix({
//       ssrEnvironment: workerdEnvironmentProvider({config: './wrangler-ssr.toml'}),
//     }),
//     tsconfigPaths(),
//   ],
//   ```
//
//  Such API should enable complex scenarios, looking at Astro is should for example enable the astro plugin
//  to use workerd as both its edgeMiddlewareEnvironment and ssrEnvironment:
//  ```
//  plugins: [
//    astro({
//      edgeMiddlewareEnv: workerdEnvironmentProvider({config: './wrangler-middleware.toml'}),
//      ssrEnv: workerdEnvironmentProvider({config: './wrangler-ssr.toml'}),
//    }),
//    tsconfigPaths(),
//  ],
//  ```
//  and allow to easily swap the ssr environment to node or whatever else:
//  ```
//  plugins: [
//    astro({
//      edgeMiddlewareEnv: workerdEnvironmentProvider({config: './wrangler-middleware.toml'}),
//      ssrEnv: node16EnvironmentProvider({nodeFlags: '--experimental-wasm-modules'})}),
//    }),
//    tsconfigPaths(),
//  ],
//  ```
//
