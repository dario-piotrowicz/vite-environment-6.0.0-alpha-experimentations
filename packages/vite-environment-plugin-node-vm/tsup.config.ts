import { defineConfig } from 'tsup';

const buildPluginConfig = defineConfig({
  entry: ['src/index.ts'],
  outDir: 'dist',
  dts: true,
  format: ['esm'],
  platform: 'node',
  external: ['@cspotcode/source-map-support', 'lightningcss', 'esbuild', 'vite'],
});

export default [buildPluginConfig];
