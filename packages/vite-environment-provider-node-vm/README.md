# Vite Environment Provider Node-VM

Package that exports a `nodeVmEnvironmentProvider` function that can be used to set a Vite Environment to run code inside a [Node.js `vm` module](https://nodejs.org/api/vm.html).

> [!NOTE]
> Based on the [vite@6.0.0-alpha.11](https://www.npmjs.com/package/vite/v/6.0.0-alpha.11) Environment API implementation.

## Package Usage

The package exposes the `nodeVMEnvironmentProvider` function that can be used to create new environments that run code inside a node vm:
```ts
environments: {
  myEnvironment: nodeVMEnvironmentProvider(),
}
```

this sets both a `dev` and a `build` environments (of course users can also process the `nodeVMEnvironmentProvider` returned value to tweak the returned environments and/or use only one of them).

In the case of the dev environment, the environment instance is enhanced with an `api` field that contains a `getHandler` method, this is what can then be used to handle incoming requests (making sure that they are run inside the node vm):
```ts
const handler = await devEnv.api.getHandler({
  entrypoint: myEntrypoint,
});
```

You can see usage examples [here](../../examples/dummy-framework/frameworkPlugin.ts) and [here](https://github.com/dario-piotrowicz/remix/blob/2.9.1-vite-env-2/packages/remix-dev/vite/plugin.ts).
