// @ts-check
import { exec } from 'node:child_process';
import { readFile, writeFile, readdir } from 'node:fs/promises';

let commitCreated = false;

const packagesToPublish = await readdir('./packages');

for (const packageName of packagesToPublish) {
  const myPackageChanged = await hasPackageChangedInLastCommit(packageName);

  if (myPackageChanged) {
    const packageJsonPath = `packages/${packageName}/package.json`;
    const packageJson = await readFile(packageJsonPath, 'utf8');
    const versionStrMatch = packageJson.match(/"version": "0\.0\.(\d+)"/);
    if (versionStrMatch) {
      const patch = parseInt(versionStrMatch[1]);
      if (patch >= 0) {
        let newPatch = patch + 1;
        const updatedPackageJson = packageJson.replace(
          `"version": "0.0.${patch}"`,
          `"version": "0.0.${newPatch}"`,
        );
        await writeFile(packageJsonPath, updatedPackageJson);

        await execCommand('git add .');
        await execCommand(
          `git commit -m "bump ${packageName} to \"0.0.${newPatch}\""`,
        );
        commitCreated = true;

        // const packageNameToPublish = `@dario-hacking/${packageName.replace('vite-environment-provider', 'vite-6-alpha-environment-provider')}`;
        const packageNameToPublish = `@flarelabs-net/${packageName}`;

        await execCommand(`pnpm publish --filter ${packageNameToPublish}`);

        console.log(`package ${packageName} published! 🚀`);
      }
    }
  }
}

if (commitCreated) {
  // Note: in order for the push to work you need to grant write permissions to the gh action:
  // https://stackoverflow.com/questions/70538793/remote-write-access-to-repository-not-granted-fatal-unable-to-access
  await execCommand('git push');
}

/**
 * @param {string} packageName the name of the package
 * @returns {Promise<boolean>}
 */
async function hasPackageChangedInLastCommit(packageName) {
  const changedFilesInPackage = parseInt(
    await execCommand(
      `echo "$(git diff HEAD~1 --name-only | grep '^packages/${packageName}/*' | wc -l | xargs )"`,
    ),
  );
  return changedFilesInPackage > 0;
}

/**
 * @param {string} command the command to run
 * @returns {Promise<string>} the command's output (stdout)
 */
async function execCommand(command) {
  let resolveFn;
  const promise = new Promise(resolve => (resolveFn = resolve));

  exec(command, {}, (error, stdout) => {
    if (error) {
      throw new Error(`Exec Error: ${error.message}`);
    }
    resolveFn(stdout);
  });

  return promise;
}
