import { defineConfig } from 'tsup';

const buildChildProcessConfig = defineConfig({
  entry: ['src/child-process/index.ts'],
  outDir: 'dist/child-process',
  format: ['esm'],
  platform: 'node',
});

const buildPluginConfig = defineConfig({
  entry: ['src/index.ts'],
  outDir: 'dist',
  dts: true,
  format: ['esm'],
  platform: 'node',
  external: [
    '@cspotcode/source-map-support',
    'lightningcss',
    'esbuild',
    'vite',
  ],
});

export default [buildChildProcessConfig, buildPluginConfig];
