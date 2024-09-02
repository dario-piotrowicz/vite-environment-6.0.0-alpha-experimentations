import { defineConfig } from 'tsup';

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

/**
 * This configuration for our custom cjs import
 */
const workerdCustomImportConfig = defineConfig({
  entry: ['src/workerd-custom-import.cts'],
  outDir: 'dist',
  format: ['cjs'],
  platform: 'node',
  noExternal: [/.*/],
});

const buildPluginConfig = defineConfig({
  entry: ['src/index.ts'],
  outDir: 'dist',
  dts: true,
  format: ['esm'],
  platform: 'node',
  external: [
    'miniflare',
    'workerd',
    '@cspotcode/source-map-support',
    'lightningcss',
    'esbuild',
    'vite',
  ],
});

export default [
  buildWorkerConfig,
  workerdCustomImportConfig,
  buildPluginConfig,
];
