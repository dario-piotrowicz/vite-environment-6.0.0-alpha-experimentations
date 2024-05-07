# Remix App Example

To run the app build (with `pnpm build`) the remix-dev package from https://github.com/dario-piotrowicz/remix/pull/1

Then accordingly update the package.json to point to your remix-dev local package:
```diff
- "@remix-run/dev": "/Users/dario/Repos/my-repos/remix/packages/remix-dev",
+ "@remix-run/dev": "<YOUR_REMIX_LOCATION>/packages/remix-dev",
```

Finally, simply run `pnpm dev` to run the application
