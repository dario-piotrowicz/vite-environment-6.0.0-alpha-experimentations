# Vite Environment 6.0.0 experimentations

Experimentations based on the [_experimental_ Vite Environment API](https://deploy-preview-16471--vite-docs-main.netlify.app/guide/api-vite-environment.html) being worked on for `vite@6.0.0-alpha.x`

## Setup

Simply run:
```
$ pnpm i
```
to install all the dependencies and build all the packages in this repository, there you can `cd` in any of the examples and run their development scripts.

## Monorepo Structure

- `packages`

  Basically contains plugins that using the Vite Environment API allow to run code in Alternative JS Runtimes

- `examples`

  Contains examples of usages of the above mentioned runtime packages

> [!NOTE]
> All the packages and examples have their own README files explaining the package/example

> [!NOTE]
> The most important example currently here is `remix-app-workerd` which uses `packages/vite-environment-provider-workerd` to server side render a Remix application in the workerd environment.

## Extra info

- we patch the vite dependency (see: `patches/vite@6.0.0-alpha.18.patch`) because the Vite implementation lacks customization options in their resolver, this should hopefully get fixed soon: https://github.com/vitejs/vite/pull/16471#discussion_r1619160848

### Credits & References

- [**Vite Environment API GitHub discussion**](https://github.com/vitejs/vite/discussions/16358)
- [**vite-environment-examples** (by _hi-ogawa_)](https://github.com/hi-ogawa/vite-environment-examples)
