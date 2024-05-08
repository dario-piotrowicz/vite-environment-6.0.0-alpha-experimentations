import { viteEnvironmentPluginWorkerd } from 'vite-environment-plugin-workerd';
import { viteEnvironmentPluginNodeVM } from 'vite-environment-plugin-node-vm';

export function environmentPlugin() {
  const environmentPlugin =
    process.env['vite_env'] === 'workerd'
      ? viteEnvironmentPluginWorkerd
      : viteEnvironmentPluginNodeVM;

  return environmentPlugin();
}
