# Remix App Workerd Example

Minimal Remix application that uses the `vite-environment-provider-workerd` package to run the app's server side code inside workerd.

> [!Note]
> The `@remix-run/dev` package is a build generated from the code at:
> https://github.com/dario-piotrowicz/remix/tree/2.9.1-vite-env-2

## Key aspects

Some key aspects to note regarding this example are:

 - that we've added two options to the remix plugin: `ssrEnvironment` and `ssrRuntime`, the former allows the user to provide the environment to be used while the latter is for letting remix know what runtime is being targeted, this is necessary so that remix can use the correct entrypoint for the current runtime.\
 \
 Relevant remix code references:
   - [creating the ssr environment](https://github.com/dario-piotrowicz/remix/blob/6a8c12380453c7fd01718810683475ccdb690eff/packages/remix-dev/vite/plugin.ts#L1049-L1065)
   - [updating the entrypoint if workerd is the targeted runtime](https://github.com/dario-piotrowicz/remix/blob/6a8c12380453c7fd01718810683475ccdb690eff/packages/remix-dev/vite/plugin.ts#L1322-L1327)
   - [creating a handler using the dev environment](https://github.com/dario-piotrowicz/remix/blob/6a8c12380453c7fd01718810683475ccdb690eff/packages/remix-dev/vite/plugin.ts#L1427-L1431)

 - if you look at the remix plugin forked implementation you can see ([here](https://github.com/dario-piotrowicz/remix/blob/6a8c12380453c7fd01718810683475ccdb690eff/packages/remix-dev/vite/plugin.ts#L1328-L1330)) that no special pre-bundling nor other workerd-specific options (except simply setting `webCompatible` to `true`) need to be applied. Modules are fetched on-demand and the environment supports the use of both cjs and esm external modules.
