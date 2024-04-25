import { defineConfig } from 'tsup';

// build in two steps to export worker entry script as string

/**
 * This configuration is for building the worker, which can then be
 * used by the plugin
 */
const buildWorkerConfig = defineConfig({
  entry: ['src/worker/index.ts'],
  outDir: 'dist/worker',
  format: ['esm'],
  platform: 'browser',
  noExternal: [/.*/],
});

const buildPluginConfig = defineConfig({
  entry: ['src/index.ts'],
  outDir: 'dist',
  dts: true,
  format: ['cjs'],
  platform: 'node',
  external: ['miniflare', 'workerd', '@cspotcode/source-map-support', 'lightningcss', 'esbuild', 'vite'],
});

export default [buildWorkerConfig, buildPluginConfig];
