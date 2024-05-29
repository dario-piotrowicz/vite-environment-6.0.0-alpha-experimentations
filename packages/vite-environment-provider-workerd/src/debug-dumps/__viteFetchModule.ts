import { dirname } from 'node:path';
import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { runDir } from './shared';

const __viteFetchModuleRunDir = `${runDir}/__viteFetchModule`;
await mkdir(__viteFetchModuleRunDir);
const __viteFetchModuleImportsFilePath = `${__viteFetchModuleRunDir}/imports.txt`;
await writeFile(__viteFetchModuleImportsFilePath, '');

let dump__viteFetchModuleCounter = 0;

export async function dump__viteFetchModuleLog(
  __viteFetchModuleArgs: unknown,
  result: { externalize: string } | { code: string },
) {
  const importFilePath = (__viteFetchModuleArgs[0] as string).replace(
    '/Users/dario/Repos/my-repos/',
    '/',
  );

  await appendFile(
    __viteFetchModuleImportsFilePath,
    `${`${dump__viteFetchModuleCounter}`.padStart(3, '0')} - ${importFilePath}${
      'externalize' in result ? ` (externalize to: ${result.externalize})` : ''
    }\n`,
  );

  dump__viteFetchModuleCounter++;

  const runFilePath = `${__viteFetchModuleRunDir}/imported/${importFilePath}`;
  await mkdir(dirname(runFilePath), { recursive: true });

  const importer = (__viteFetchModuleArgs[1] as string | undefined)?.replace(
    '/Users/dario/Repos/my-repos/',
    '/',
  );
  await writeFile(runFilePath, `// imported from ${importer ?? 'unknown'}\n`);

  if ('externalize' in result) {
    await appendFile(runFilePath, `// externalize: ${result.externalize}`);
  }

  if ('code' in result) {
    await appendFile(runFilePath, result.code);
  }
}